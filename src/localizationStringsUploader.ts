import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet, SourceType } from "./models";
import * as GitHubApi from "github";
import { GithubApiCreator } from "./githubApiCreator";

class ShaModel {
    treeSha: string;
    commitSha: string;
    headCommitSha: string;
}

export class LocalizationStringsUploader {
    private static github: GitHubApi;
    public static localizationUtilsRepoName: string = "powerbi-visuals-utils-localizationutils";
    public static ms: string = "Microsoft";
    private static enUs: string = "en-US";
    private static pullRequestTitle: string = "Localization string update (auto PR by pbicvbot)";

    private static pbicvbot: string = "pbicvbot";

    public static async UploadStringsToCommonRepo(updatedVisuals: IndexedFoldersSet) {

        if (!Object.keys(updatedVisuals).length) {
            console.log("Nothing to update");
            return null;
        }

        let sha: ShaModel;

        let github: GitHubApi = GithubApiCreator.CreateGithubApi();

        let prExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(LocalizationStringsUploader.ms, 
            LocalizationStringsUploader.localizationUtilsRepoName,
            "pbicvbot:master");

        sha = await LocalizationStringsUploader.GetShaModelForCurrentCommit(github, LocalizationStringsUploader.localizationUtilsRepoName, "heads/master");

        let namedBlobs: { [key: string]: string } = {};
        let promises: Promise<any>[] = [];

        for (let visualName in updatedVisuals) {
            let content: IndexedObjects = updatedVisuals[visualName][LocalizationStringsUploader.enUs];

            promises.push(
                github.gitdata.createBlob({
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

        for(let visualName in namedBlobs) {
            let blobSha: string = namedBlobs[visualName];

            trees.push({
                "path": visualName + "/en-US/resources.resjson",
                "mode": "100644",
                "type": "blob",
                "sha": blobSha
            });
        }

        github.gitdata.createTree({
            owner: LocalizationStringsUploader.pbicvbot,
            repo: LocalizationStringsUploader.localizationUtilsRepoName,
            base_tree: sha.treeSha,
            tree: JSON.stringify(trees)
        })
        .then((newTree) => {
            return github.gitdata.createCommit({
                message: "updated localization strings",
                tree: newTree.data.sha,
                owner: LocalizationStringsUploader.pbicvbot,
                repo: LocalizationStringsUploader.localizationUtilsRepoName,
                parents: [sha.headCommitSha]
            });
        })
        .then((ref) => {
            return github.gitdata.updateReference({
                force: true,
                owner: LocalizationStringsUploader.pbicvbot,
                repo: LocalizationStringsUploader.localizationUtilsRepoName,
                ref: "heads/master",
                sha: ref.data.sha
            });
        })
        .then(() => {
            return github.pullRequests.getAll({
                owner: LocalizationStringsUploader.ms,
                repo: LocalizationStringsUploader.localizationUtilsRepoName 
            })
            .then((pullRequests) => {
                if (!prExists) {
                    return github.pullRequests.create({
                        base: "master",
                        owner: LocalizationStringsUploader.ms,
                        repo: LocalizationStringsUploader.localizationUtilsRepoName,
                        head: "pbicvbot:master",
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

        let promises: Promise<any>[] = [];

        let github: GitHubApi = GithubApiCreator.CreateGithubApi();

        let branchRef: string = source === SourceType.Capabilities ? "heads/locUpdateCapabilities" : "heads/locUpdate";
        let prHead: string = source === SourceType.Capabilities ? "pbicvbot:locUpdateCapabilities" : "pbicvbot:locUpdate";

        for (let visualName in updatedVisuals) {
            let folders: IndexedObjects = updatedVisuals[visualName];

            let sha: ShaModel;

            let prExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(LocalizationStringsUploader.ms, visualName, prHead);

            if (!prExists) {
                sha = await LocalizationStringsUploader.UpdateBranchFromMasterRepo(github, visualName, branchRef);
            } else {
                sha = await LocalizationStringsUploader.GetShaModelForCurrentCommit(github, visualName, branchRef);
            }
            
            if (Object.keys(folders).length) {
                let promises: Promise<any>[] = [];

                for (let folderName in folders) {
                    if (folderName === LocalizationStringsUploader.enUs && source === SourceType.UtilsRepo) {
                        continue;
                    } 
                    
                    let content: {} = folders[folderName];

                    promises.push(github.gitdata.createBlob({
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
                        return github.gitdata.createTree({
                            owner: LocalizationStringsUploader.pbicvbot,
                            repo: visualName,
                            base_tree: sha.treeSha,
                            tree: JSON.stringify(treesArrays)
                        });
                    })
                    .then((newTree) => {
                        console.log("after create tree " + visualName);
                        console.log("before create commit " + visualName);
                        return github.gitdata.createCommit({
                            message: "updated localization strings",
                            tree: newTree.data.sha,
                            owner: LocalizationStringsUploader.pbicvbot,
                            repo: visualName,
                            parents: [sha.headCommitSha]
                        });
                    })
                    .then((ref) => {
                        console.log("after create commit " + visualName);
                        return github.gitdata.updateReference({
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

                            return github.pullRequests.create({
                                base: "master",
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

    public static async UpdateBranchFromMasterRepo(github: GitHubApi, repo: string, branchRef: string): Promise<ShaModel> {
        let headRefSha: string = "";

        return github.gitdata.getReference({
            owner: LocalizationStringsUploader.ms,
            repo: repo,
            ref: "heads/master"
        })
        .then((ref) => {
            headRefSha = ref.data.object.sha;

            return github.gitdata.updateReference({
                force: true,
                ref: branchRef,
                owner: LocalizationStringsUploader.pbicvbot,
                repo: repo, 
                sha: headRefSha
            });
        })
        .then(() => {
            return github.gitdata.getCommit({
                owner: LocalizationStringsUploader.pbicvbot,
                repo: repo,
                sha: headRefSha
            });
        })
        .then((commit) => {
            return {
                treeSha: commit.data.tree.sha,
                commitSha: commit.data.sha,
                headCommitSha: headRefSha
            }
        });
    }

    public static async GetShaModelForCurrentCommit(github: GitHubApi, repo: string, ref: string): Promise<ShaModel> {
        let headRefSha: string = "";

        return github.gitdata.getReference({
            owner: LocalizationStringsUploader.pbicvbot,
            repo: repo,
            ref: ref
        })
        .then((ref) => {
            headRefSha = ref.data.object.sha;

            return github.gitdata.getCommit({
                owner: LocalizationStringsUploader.pbicvbot,
                repo: repo,
                sha: headRefSha
            });
        })
        .then((commit) => {
            return {
                treeSha: commit.data.tree.sha,
                commitSha: commit.data.sha,
                headCommitSha: headRefSha
            }
        });
    }

    public static async IsPullRequestExists(owner: string, repo: string, head: string): Promise<boolean> {
        return GithubApiCreator.CreateGithubApi().pullRequests.getAll({
            owner: owner,
            repo: repo
        })
        .then((pullRequests) => {
            let prExists: boolean = false;
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