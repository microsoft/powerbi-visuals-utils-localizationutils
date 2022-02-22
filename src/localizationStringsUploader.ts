import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet, SourceType } from "./models";
import { Octokit } from "@octokit/rest";
import { GithubApiCreator } from "./githubApiCreator";
import { BranchCreator } from "./branchCreator";

const config = require('../config.json');

interface ShaModel {
    treeSha: string;
    commitSha: string;
    headCommitSha: string;
}

export class LocalizationStringsUploader {
    private static githubApi: Octokit = GithubApiCreator.CreateGithubApi();
    private static enUs: string = "en-US";
    private static owner: string = config.ownerName;

    public static mainRepoName: string = config.repoName;
    public static ms: string = "Microsoft";

    private static async GetDefaultBranchName(owner: string, repoName: string) {
        const repo = await LocalizationStringsUploader.githubApi.rest.repos.get({
            owner,
            repo: repoName,
        })
        return repo.data["default_branch"]
    }

    public static async UploadStringsToCommonRepo(updatedVisuals: IndexedFoldersSet) {

        if (!Object.keys(updatedVisuals).length) {
            console.log("Nothing to update");
            return null;
        }

        const namedBlobs: { [key: string]: string } = {};
        const promises: Promise<any>[] = [];

        for (let visualName in updatedVisuals) {
            let content: IndexedObjects = updatedVisuals[visualName][LocalizationStringsUploader.enUs];

            promises.push(
                this.githubApi.rest.git.createBlob({
                    content: JSON.stringify(content, null, "\t"),
                    encoding: "utf-8",
                    owner: LocalizationStringsUploader.owner,
                    repo: LocalizationStringsUploader.mainRepoName
                })
                    .then((blob) => {
                        namedBlobs[visualName] = blob.data.sha;
                    })
            );
        }

        await Promise.all(promises)
            .catch(err => {
                console.log(err);
            });

        const trees: object[] = [];

        for (const visualName in namedBlobs) {
            const blobSha: string = namedBlobs[visualName];

            trees.push({
                "path": visualName + "/en-US/resources.resjson",
                "mode": "100644",
                "type": "blob",
                "sha": blobSha
            });
        }
        const defaultBranchName = await LocalizationStringsUploader.GetDefaultBranchName(LocalizationStringsUploader.owner, LocalizationStringsUploader.mainRepoName)
        const sha: ShaModel = await LocalizationStringsUploader.GetShaModelForCurrentCommit(
            this.githubApi, 
            LocalizationStringsUploader.mainRepoName, 
            `heads/${defaultBranchName}`
        );

        const newTree = await this.githubApi.rest.git.createTree({
            owner: LocalizationStringsUploader.owner,
            repo: LocalizationStringsUploader.mainRepoName,
            base_tree: sha.treeSha,
            tree: trees
        })
            
        const newCommitReference = await this.githubApi.rest.git.createCommit({
            message: "updated localization strings",
            tree: newTree.data.sha,
            owner: LocalizationStringsUploader.owner,
            repo: LocalizationStringsUploader.mainRepoName,
            parents: [sha.headCommitSha]
        });

        await this.githubApi.rest.git.updateRef({
            force: true,
            owner: LocalizationStringsUploader.owner,
            repo: LocalizationStringsUploader.mainRepoName,
            ref: `heads/${defaultBranchName}`,
            sha: newCommitReference.data.sha
        });

        const isPullRequestExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(
            LocalizationStringsUploader.ms,
            LocalizationStringsUploader.mainRepoName,
            `${this.owner}:${defaultBranchName}`
        );
        if (!isPullRequestExists) {
            return this.githubApi.rest.pulls.create({
                base: defaultBranchName,
                owner: LocalizationStringsUploader.ms,
                repo: LocalizationStringsUploader.mainRepoName,
                head: `${this.owner}:${defaultBranchName}`,
                title: "Localization strings update"
            });
        }
    }

    public static async UploadStringsToAllRepos(updatedVisuals: IndexedFoldersSet, source: SourceType) {

        if (!Object.keys(updatedVisuals).length) {
            console.log("Nothing to update");
            return null;
        }

        const branchName = source === SourceType.Capabilities ? "locUpdateCapabilities" : "locUpdate";
        const branchRef: string = `heads/${branchName}`
        const pullRequestToHead: string = `${this.owner}:${branchName}`;

        for (let visualName in updatedVisuals) {
            const folders: IndexedObjects = updatedVisuals[visualName];

            let sha: ShaModel;

            const isPullRequestExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(LocalizationStringsUploader.ms, visualName, pullRequestToHead);

            if (!isPullRequestExists) {
                const isBranchExists = await BranchCreator.IsBranchExists(branchName, visualName)
                if(!isBranchExists){
                    await BranchCreator.CreateBranch(branchName, visualName)
                }

                sha = await LocalizationStringsUploader.UpdateBranchFromMainRepo(this.githubApi, visualName, branchRef);
            } else {
                sha = await LocalizationStringsUploader.GetShaModelForCurrentCommit(this.githubApi, visualName, branchRef);
            }

            if (Object.keys(folders).length) {
                let promises: Promise<any>[] = [];

                for (let folderName in folders) {
                    if (folderName === LocalizationStringsUploader.enUs && source === SourceType.UtilsRepo) {
                        continue;
                    }

                    let content: DisplayNameAndKeyPairs = folders[folderName];
                    
                    promises.push(
                        this.githubApi.rest.git.createBlob({
                            content: JSON.stringify(content, null, "\t"),
                            encoding: "utf-8",
                            owner: LocalizationStringsUploader.owner,
                            repo: visualName
                        })
                            .then((blob) => {
                                return {
                                    path: "stringResources/" + folderName + "/resources.resjson",
                                    sha: blob.data.sha
                                }
                            })
                        );
                }

                const resolvedPromises = await Promise.all(promises)
                    
                let treesArrays: Array<object> = resolvedPromises.map((x: any) => {
                    return {
                        "path": x.path,
                        "mode": "100644",
                        "type": "blob",
                        "sha": x.sha
                    }
                });

                console.log(`trying to create tree ${visualName}`);
                const newTree = await this.githubApi.rest.git.createTree({
                    owner: LocalizationStringsUploader.owner,
                    repo: visualName,
                    base_tree: sha.treeSha,
                    tree: treesArrays
                });
                console.log(`tree ${visualName} successfully created`);

                console.log(`trying to create commit ${visualName}`);
                const commitReference = await this.githubApi.rest.git.createCommit({
                    message: "updated localization strings",
                    tree: newTree.data.sha,
                    owner: LocalizationStringsUploader.owner,
                    repo: visualName,
                    parents: [sha.headCommitSha]
                });
                console.log(`commit ${visualName} successfully created`);

                await this.githubApi.rest.git.updateRef({
                    force: true,
                    owner: LocalizationStringsUploader.owner,
                    repo: visualName,
                    ref: branchRef,
                    sha: commitReference.data.sha
                });

                if (!isPullRequestExists) {
                    const title: string = `Localization strings from ${source === SourceType.Capabilities ? "capabilities" : "utils"} update`;

                    const defaultBranchName = await LocalizationStringsUploader.GetDefaultBranchName(LocalizationStringsUploader.ms, visualName)
                    return await this.githubApi.rest.pulls.create({
                        base: defaultBranchName,
                        owner: LocalizationStringsUploader.ms,
                        repo: visualName,
                        head: pullRequestToHead,
                        title: title
                    });
                }
            }
        }
    }

    public static async UpdateBranchFromMainRepo(github: Octokit, repo: string, branchRef: string): Promise<ShaModel> {
        const defaultBranchName = await LocalizationStringsUploader.GetDefaultBranchName(LocalizationStringsUploader.ms, repo)

        const headRefSha = (await github.rest.git.getRef({
            owner: LocalizationStringsUploader.ms,
            repo: repo,
            ref: `heads/${defaultBranchName}`
        })).data.object.sha;

        await github.rest.git.updateRef({
            force: true,
            ref: branchRef,
            owner: LocalizationStringsUploader.owner,
            repo: repo,
            sha: headRefSha
        });
        
        const latestCommit = await github.rest.repos.getCommit({
                owner: LocalizationStringsUploader.owner,
                repo: repo,
                ref: headRefSha
            })

        return {
            treeSha: latestCommit.data.commit.tree.sha,
            commitSha: latestCommit.data.sha,
            headCommitSha: headRefSha
        }
    }

    public static async GetShaModelForCurrentCommit(github: Octokit, repo: string, ref: string): Promise<ShaModel> {
        const headRefSha = (await github.rest.git.getRef({
            owner: LocalizationStringsUploader.owner,
            repo: repo,
            ref: ref
        })).data.object.sha

        const currentCommit = await github.rest.repos.getCommit({
            owner: LocalizationStringsUploader.owner,
            repo: repo,
            ref: headRefSha
        });

        return {
            treeSha: currentCommit.data.commit.tree.sha,
            commitSha: currentCommit.data.sha,
            headCommitSha: headRefSha
        }
    }

    public static async IsPullRequestExists(owner: string, repo: string, head: string): Promise<boolean> {
        const pullRequestsList = await this.githubApi.rest.pulls.list({
            owner: owner,
            repo: repo
        })
        return pullRequestsList.data.some((pullRequest) => pullRequest.head.label === head)
    }
}