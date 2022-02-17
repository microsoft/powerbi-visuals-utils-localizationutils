import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet, SourceType } from "./models";
import { Octokit } from "@octokit/rest";
import { GithubApiCreator } from "./githubApiCreator";

const config = require('../config.json');

interface ShaModel {
    treeSha: string;
    commitSha: string;
    headCommitSha: string;
}

export class LocalizationStringsUploader {
    private static githubApi: Octokit = GithubApiCreator.CreateGithubApi();
    private static enUs: string = "en-US";
    private static pbicvbot: string = config.ownerName;

    public static localizationUtilsRepoName: string = "powerbi-visuals-utils-localizationutils";
    public static ms: string = "Microsoft";

    public static async UploadStringsToCommonRepo(updatedVisuals: IndexedFoldersSet) {

        if (!Object.keys(updatedVisuals).length) {
            console.log("Nothing to update");
            return null;
        }

        let prExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(LocalizationStringsUploader.ms,
            LocalizationStringsUploader.localizationUtilsRepoName,
            `${this.pbicvbot}:main`);

        const sha: ShaModel = await LocalizationStringsUploader.GetShaModelForCurrentCommit(this.githubApi, LocalizationStringsUploader.localizationUtilsRepoName, "heads/main");

        let namedBlobs: { [key: string]: string } = {};
        let promises: Promise<any>[] = [];

        for (let visualName in updatedVisuals) {
            let content: IndexedObjects = updatedVisuals[visualName][LocalizationStringsUploader.enUs];

            promises.push(
                this.githubApi.rest.git.createBlob({
                    content: JSON.stringify(content, null, "\t"),
                    encoding: "utf-8",
                    owner: LocalizationStringsUploader.pbicvbot,
                    repo: LocalizationStringsUploader.localizationUtilsRepoName
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

        let trees: object[] = [];

        for (let visualName in namedBlobs) {
            let blobSha: string = namedBlobs[visualName];

            trees.push({
                "path": visualName + "/en-US/resources.resjson",
                "mode": "100644",
                "type": "blob",
                "sha": blobSha
            });
        }

        this.githubApi.rest.git.createTree({
            owner: LocalizationStringsUploader.pbicvbot,
            repo: LocalizationStringsUploader.localizationUtilsRepoName,
            base_tree: sha.treeSha,
            tree: trees
        })
            .then((newTree) => {
                return this.githubApi.rest.git.createCommit({
                    message: "updated localization strings",
                    tree: newTree.data.sha,
                    owner: LocalizationStringsUploader.pbicvbot,
                    repo: LocalizationStringsUploader.localizationUtilsRepoName,
                    parents: [sha.headCommitSha]
                });
            })
            .then((ref) => {
                return this.githubApi.rest.git.updateRef({
                    force: true,
                    owner: LocalizationStringsUploader.pbicvbot,
                    repo: LocalizationStringsUploader.localizationUtilsRepoName,
                    ref: "heads/main",
                    sha: ref.data.sha
                });
            })
            .then(() => {
                return this.githubApi.rest.pulls.list({
                    owner: LocalizationStringsUploader.ms,
                    repo: LocalizationStringsUploader.localizationUtilsRepoName
                })
                    .then(() => {
                        if (!prExists) {
                            return this.githubApi.rest.pulls.create({
                                base: "main",
                                owner: LocalizationStringsUploader.ms,
                                repo: LocalizationStringsUploader.localizationUtilsRepoName,
                                head: `${this.pbicvbot}:main`,
                                title: "Localization strings update"
                            });
                        }
                    })
            })
            .catch((error) => {
                console.log(error);
            });
    }

    public static async UploadStringsToAllRepos(updatedVisuals: IndexedFoldersSet, source: SourceType) {

        if (!Object.keys(updatedVisuals).length) {
            console.log("Nothing to update");
            return null;
        }

        const branchRef: string = source === SourceType.Capabilities ? "heads/locUpdateCapabilities" : "heads/locUpdate";
        const prHead: string = `${this.pbicvbot} : ${source === SourceType.Capabilities ? "locUpdateCapabilities" : "locUpdate"}`;

        for (let visualName in updatedVisuals) {
            const folders: IndexedObjects = updatedVisuals[visualName];

            let sha: ShaModel;

            const prExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(LocalizationStringsUploader.ms, visualName, prHead);

            if (!prExists) {
                sha = await LocalizationStringsUploader.UpdateBranchFromMasterRepo(this.githubApi, visualName, branchRef);
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
                    
                    promises.push(this.githubApi.rest.git.createBlob({
                        content: JSON.stringify(content, null, "\t"),
                        encoding: "utf-8",
                        owner: LocalizationStringsUploader.pbicvbot,
                        repo: visualName
                    })
                        .then((blob) => {
                            return {
                                path: "stringResources/" + folderName + "/resources.resjson",
                                sha: blob.data.sha
                            }
                        }));
                }

                Promise.all(promises)
                    .then((values: object[]) => {
                        let treesArrays: Array<object> = values.map((x: any) => {
                            return {
                                "path": x.path,
                                "mode": "100644",
                                "type": "blob",
                                "sha": x.sha
                            }
                        }
                        );
                        console.log("before create tree " + visualName);
                        return this.githubApi.rest.git.createTree({
                            owner: LocalizationStringsUploader.pbicvbot,
                            repo: visualName,
                            base_tree: sha.treeSha,
                            tree: treesArrays
                        });
                    })
                    .then((newTree) => {
                        console.log("after create tree " + visualName);
                        console.log("before create commit " + visualName);
                        return this.githubApi.rest.git.createCommit({
                            message: "updated localization strings",
                            tree: newTree.data.sha,
                            owner: LocalizationStringsUploader.pbicvbot,
                            repo: visualName,
                            parents: [sha.headCommitSha]
                        });
                    })
                    .then((ref) => {
                        console.log("after create commit " + visualName);
                        return this.githubApi.rest.git.updateRef({
                            force: true,
                            owner: LocalizationStringsUploader.pbicvbot,
                            repo: visualName,
                            ref: branchRef,
                            sha: ref.data.sha
                        });
                    })
                    .then(() => {
                        if (!prExists) {
                            let title: string = "Localization strings from " + (source === SourceType.Capabilities ? "capabilities" : "utils") + " update";

                            return this.githubApi.rest.pulls.create({
                                base: "main",
                                owner: LocalizationStringsUploader.ms,
                                repo: visualName,
                                head: prHead,
                                title: title
                            });
                        }
                    });
            }
        }
    }

    public static async UpdateBranchFromMasterRepo(github: Octokit, repo: string, branchRef: string): Promise<ShaModel> {
        let headRefSha: string = "";
        const msRefName = await this.githubApi.rest.git.listMatchingRefs({
            owner: LocalizationStringsUploader.ms,
            repo: repo,
            ref: "heads/main"
        }).then(refs => refs.data.length ? "main" : "master")

        return github.rest.git.getRef({
            owner: LocalizationStringsUploader.ms,
            repo: repo,
            ref: `heads/${msRefName}`
        }).then((ref) => {
            headRefSha = ref.data.object.sha;

            return github.rest.git.updateRef({
                force: true,
                ref: branchRef,
                owner: LocalizationStringsUploader.pbicvbot,
                repo: repo,
                sha: headRefSha
            });
        }).then(() => {
            return github.rest.repos.getCommit({
                owner: LocalizationStringsUploader.pbicvbot,
                repo: repo,
                ref: headRefSha
            })
        }
        ).then((commit) => ({
                treeSha: commit.data.commit.tree.sha,
                commitSha: commit.data.sha,
                headCommitSha: headRefSha
            })
        );
    }

    public static async GetShaModelForCurrentCommit(github: Octokit, repo: string, ref: string): Promise<ShaModel> {
        let headRefSha: string = "";

        return github.rest.git.getRef({
            owner: LocalizationStringsUploader.pbicvbot,
            repo: repo,
            ref: ref
        })
            .then((ref) => {
                headRefSha = ref.data.object.sha;

                return github.rest.repos.getCommit({
                    owner: LocalizationStringsUploader.pbicvbot,
                    repo: repo,
                    ref: headRefSha
                });
            })
            .then((commit) => {
                return {
                    treeSha: commit.data.commit.tree.sha,
                    commitSha: commit.data.sha,
                    headCommitSha: headRefSha
                }
            });
    }

    public static async IsPullRequestExists(owner: string, repo: string, head: string): Promise<boolean> {
        return this.githubApi.rest.pulls.list({
            owner: owner,
            repo: repo
        })
            .then((pullRequests) => {
                for (let i in pullRequests.data) {
                    let pr = pullRequests.data[i];

                    if (pr.head.label === head) {
                        return true;
                    }
                }

                return false;
            });
    }
}