'use strict';

/**
 * Commits the staged changes through the GitHub GraphQL createCommitOnBranch mutation
 * and makes sure a pull request is open for the resulting branch.
 *
 * The mutation is used because the `microsoft` organization requires signed commits and a
 * GitHub App has no GPG key, so `git commit -S` is not an option. GitHub signs commits made
 * through the mutation with its own key.
 *
 * Content is taken from the git index, never from disk. `.gitattributes` filters such as
 * `text eol=lf` are applied on `git add`, so a file on disk can differ from the blob git
 * diffed against - uploading the file would commit content identical to the base and produce
 * an empty commit.
 *
 * Opening the pull request is part of this script on purpose: a run that commits and then
 * fails to open a pull request would leave the content stranded on a branch nobody looks at.
 *
 * Usage:
 *   node src/commit-and-open-pr.js \
 *     --repo microsoft/some-repo --branch new_translations \
 *     --message "New translations" --title "New translations" \
 *     --path stringResources --exclude stringResources/en-US
 *
 * Requires GH_TOKEN with contents:write and pull-requests:write on the target repository.
 */

const { execFileSync, spawnSync } = require('node:child_process');

const API = 'https://api.github.com';
const USER_AGENT = 'powerbi-visuals-localization';

/** createCommitOnBranch rejects requests above 40 MB, and base64 inflates content by a third. */
const MAX_PAYLOAD_BYTES = 40 * 1024 * 1024;

const FLAGS = {
    repo: { required: true },
    branch: { required: true },
    message: { required: true },
    title: { required: true },
    body: {},
    base: {},
    path: { multiple: true },
    exclude: { multiple: true },
};

function parseArguments(argv) {
    // Null prototype: names come from argv, so `--__proto__` must stay an unknown flag.
    const options = Object.create(null);
    options.path = [];
    options.exclude = [];

    for (let i = 0; i < argv.length; i += 2) {
        const argument = argv[i];
        const value = argv[i + 1];
        if (!argument.startsWith('--') || value === undefined) {
            throw new Error(`Malformed argument near "${argument}"`);
        }
        const name = argument.slice(2);
        if (!Object.hasOwn(FLAGS, name)) { throw new Error(`Unknown argument "${argument}"`); }
        if (FLAGS[name].multiple) {
            options[name].push(value);
        } else if (options[name] !== undefined) {
            throw new Error(`--${name} was given more than once`);
        } else {
            options[name] = value;
        }
    }

    for (const [name, flag] of Object.entries(FLAGS)) {
        if (flag.required && !options[name]) { throw new Error(`--${name} is required`); }
    }
    if (options.path.length === 0) { options.path.push('.'); }
    return options;
}

function git(args, cwd) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (result.error) { throw result.error; }
    if (result.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
    }
    return result.stdout.trim();
}

/** `git diff --quiet` reports difference through its exit code, so failure is expected here. */
function hasDifference(args, cwd) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (result.status === 0) { return false; }
    if (result.status === 1) { return true; }
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
}

function readBlob(oid, cwd) {
    return execFileSync('git', ['cat-file', 'blob', oid], {
        cwd,
        encoding: 'buffer',
        maxBuffer: 256 * 1024 * 1024,
    });
}

/** Slashes separate path segments in a ref, so only the characters within a segment are escaped. */
function encodeRef(branch) {
    return branch.split('/').map(encodeURIComponent).join('/');
}

function createApi(token) {
    return async function api(method, url, body) {
        const response = await fetch(url.startsWith('http') ? url : `${API}${url}`, {
            method,
            signal: AbortSignal.timeout(120000),
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': USER_AGENT,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const text = await response.text();
        const payload = text ? JSON.parse(text) : null;
        return { status: response.status, ok: response.ok, payload };
    };
}

function collectChanges(baseSha, paths, cwd) {
    // -z emits `<meta>\0<path>\0` records, so paths are never quoted or escaped; --raw exposes
    // the blob SHAs so a mode-only change can be told apart from a content change.
    const raw = git(
        ['diff', '--cached', '--raw', '--no-renames', '--no-abbrev', '-z', baseSha, '--', ...paths],
        cwd,
    );

    const additions = [];
    const deletions = [];
    const records = raw.split('\0');

    for (let i = 0; i + 1 < records.length; i += 2) {
        const meta = records[i];
        const path = records[i + 1];
        if (!meta || !path) { continue; }
        const fields = meta.replace(/^:/, '').split(/\s+/);
        if (fields.length < 5) { continue; }
        const [, , oldSha, newSha, status] = fields;

        // createCommitOnBranch always writes mode 100644, so a mode-only change commits nothing.
        if (oldSha === newSha) { continue; }

        if (status === 'D') {
            deletions.push({ path });
        } else {
            additions.push({ path, contents: readBlob(newSha, cwd).toString('base64') });
        }
    }

    return { additions, deletions };
}

async function getBranchTip(api, repo, branch) {
    const response = await api('GET', `/repos/${repo}/git/ref/heads/${encodeRef(branch)}`);
    if (response.status === 404) { return null; }
    if (!response.ok) {
        throw new Error(`Failed to read branch ${branch}: ${response.status}`);
    }
    return response.payload.object.sha;
}

async function moveBranch(api, repo, branch, sha) {
    const response = await api('PATCH', `/repos/${repo}/git/refs/heads/${encodeRef(branch)}`, { sha, force: true });
    if (!response.ok) { throw new Error(`Failed to move ${branch}: ${response.status}`); }
}

async function createCommit(api, { repo, branch, message, baseSha, additions, deletions }) {
    const response = await api('POST', `${API}/graphql`, {
        query: 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { url } } }',
        variables: {
            input: {
                branch: { repositoryNameWithOwner: repo, branchName: branch },
                expectedHeadOid: baseSha,
                message: { headline: message },
                fileChanges: { additions, deletions },
            },
        },
    });

    if (!response.ok || response.payload.errors) {
        throw new Error(`createCommitOnBranch failed: ${JSON.stringify(response.payload && response.payload.errors)}`);
    }
    return response.payload.data.createCommitOnBranch.commit.url;
}

async function ensurePullRequest(api, { repo, branch, base, title, body }) {
    const owner = repo.split('/')[0];
    const head = encodeURIComponent(`${owner}:${branch}`);
    const existing = await api('GET', `/repos/${repo}/pulls?state=open&head=${head}`);
    if (!existing.ok) { throw new Error(`Failed to list pull requests: ${existing.status}`); }
    if (existing.payload.length > 0) {
        console.log(`Pull request #${existing.payload[0].number} already open on ${branch}`);
        return existing.payload[0].number;
    }

    let baseBranch = base;
    if (!baseBranch) {
        const repoInfo = await api('GET', `/repos/${repo}`);
        if (!repoInfo.ok) { throw new Error(`Failed to read ${repo}: ${repoInfo.status}`); }
        baseBranch = repoInfo.payload.default_branch;
    }

    const created = await api('POST', `/repos/${repo}/pulls`, { title, head: branch, base: baseBranch, body });
    if (!created.ok) {
        throw new Error(`Failed to create pull request: ${created.status} ${JSON.stringify(created.payload)}`);
    }
    console.log(`Opened pull request #${created.payload.number} on ${branch}`);
    return created.payload.number;
}

async function commitAndOpenPr(options) {
    const cwd = process.cwd();
    const token = process.env.GH_TOKEN;
    if (!token) { throw new Error('GH_TOKEN environment variable is empty'); }

    const { repo, branch, message, title } = options;
    const paths = [...options.path, ...options.exclude.map((excluded) => `:(exclude)${excluded}`)];

    const api = createApi(token);

    git(['add', '-A', '--', ...paths], cwd);
    const baseSha = git(['rev-parse', 'HEAD'], cwd);
    const branchTip = await getBranchTip(api, repo, branch);

    let remoteTip = null;
    if (branchTip) {
        git(['fetch', '--quiet', 'origin', `refs/heads/${branch}`], cwd);
        remoteTip = git(['rev-parse', 'FETCH_HEAD'], cwd);
    }

    // The branch is worth a pull request whenever its content is not already in the base,
    // even when this run has nothing new to add.
    const branchDiffersFromBase = remoteTip !== null
        && hasDifference(['diff', '--quiet', baseSha, remoteTip, '--', ...paths], cwd);

    const finish = async (reason) => {
        console.log(reason);
        if (branchDiffersFromBase) {
            return ensurePullRequest(api, { repo, branch, base: options.base, title, body: options.body });
        }
        return null;
    };

    if (!hasDifference(['diff', '--cached', '--quiet', baseSha, '--', ...paths], cwd)) {
        return finish(`Nothing to commit for ${paths.join(', ')}`);
    }

    if (remoteTip && !hasDifference(['diff', '--cached', '--quiet', remoteTip, '--', ...paths], cwd)) {
        return finish(`Branch ${branch} already carries this content`);
    }

    const { additions, deletions } = collectChanges(baseSha, paths, cwd);
    if (additions.length === 0 && deletions.length === 0) {
        return finish(`No content changes for ${paths.join(', ')}`);
    }

    const payloadBytes = additions.reduce((total, file) => total + file.contents.length, 0);
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
        throw new Error(
            `Commit payload is ${(payloadBytes / 1024 / 1024).toFixed(1)} MB across ${additions.length} files, `
            + `over the ${MAX_PAYLOAD_BYTES / 1024 / 1024} MB createCommitOnBranch limit`,
        );
    }

    console.log(`Committing ${additions.length} additions and ${deletions.length} deletions to ${repo}`);

    if (!branchTip) {
        const created = await api('POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: baseSha });
        if (!created.ok) { throw new Error(`Failed to create ${branch}: ${created.status}`); }
    } else if (branchTip !== baseSha) {
        await moveBranch(api, repo, branch, baseSha);
        console.log(`Re-pointed ${branch} at ${baseSha}`);
    }

    let commitUrl;
    try {
        commitUrl = await createCommit(api, { repo, branch, message, baseSha, additions, deletions });
    } catch (error) {
        // The branch was already force-moved to the base, so leaving it there would empty an open pull request.
        if (branchTip && branchTip !== baseSha) {
            try {
                await moveBranch(api, repo, branch, branchTip);
                console.log(`Restored ${branch} to ${branchTip}`);
            } catch {
                console.warn(`Could not restore ${branch} to ${branchTip}`);
            }
        }
        throw error;
    }

    console.log(`Created signed commit ${commitUrl}`);
    return ensurePullRequest(api, { repo, branch, base: options.base, title, body: options.body });
}

async function main() {
    await commitAndOpenPr(parseArguments(process.argv.slice(2)));
}

main().catch((error) => {
    // exitCode rather than exit(): exit() drops buffered stdio, which is how CI captures this.
    console.error(error.message);
    process.exitCode = 1;
});
