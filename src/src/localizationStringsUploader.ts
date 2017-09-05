import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet, SourceType } from "./models";
import * as GitHubApi from "github";

export class LocalizationStringsUploader {
    private static localizationUtilsRepoName: string = "powerbi-visuals-utils-localizationutils";
    private static ms: string = "Microsoft";
    private static enUs: string = "en-US";
    private static pullRequestTitle: string = "Localization string update (auto PR by pbicvbot)";

    private static token: string = <string>process.env.token;
    private static pbicvbot: string = "pbicvbot";

    public static async UploadStringsToCommonRepo(updatedVisuals: IndexedFoldersSet) {
        let headRefShaMs: string,
            commitSha: string,
            treeSha: string = "",
            blobSha: string;

        let github: GitHubApi = new GitHubApi({
                    debug: true,
                    protocol: "https",
                    host: "api.github.com",
                    followRedirects: false,
                    timeout: 10000
                });

        github.authenticate({
            type: "oauth",
            token: LocalizationStringsUploader.token
        });

        let res = await github.gitdata.getReference({
                owner: LocalizationStringsUploader.ms,
                repo: LocalizationStringsUploader.localizationUtilsRepoName,
                ref: "heads/master"
            })
            .then((ref) => {
                headRefShaMs = ref.data.object.sha;

                return github.gitdata.updateReference({
                    force: true,
                    ref: "heads/master",
                    owner: LocalizationStringsUploader.pbicvbot,
                    repo: LocalizationStringsUploader.localizationUtilsRepoName,
                    sha: headRefShaMs
                });
            });

        await github.gitdata.getReference({
                owner: LocalizationStringsUploader.ms,
                repo: LocalizationStringsUploader.localizationUtilsRepoName,
                ref: "heads/master"
            })
            .then((ref) => {
                return github.gitdata.getCommit({
                    owner: LocalizationStringsUploader.ms,
                    repo: LocalizationStringsUploader.localizationUtilsRepoName,
                    sha: ref.data.object.sha
                });
            })
            .then((commit) => {
                treeSha = commit.data.tree.sha;
                commitSha = commit.data.sha;
            });

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

        if(!treeSha) {
            throw new Error("tree sha wasn't received");
        }

        github.gitdata.createTree({
            owner: LocalizationStringsUploader.pbicvbot,
            repo: LocalizationStringsUploader.localizationUtilsRepoName,
            base_tree: treeSha,
            tree: JSON.stringify(trees)
        })
        .then((newTree) => {
            return github.gitdata.createCommit({
                message: "updated localization strings",
                tree: newTree.data.sha,
                owner: LocalizationStringsUploader.pbicvbot,
                repo: LocalizationStringsUploader.localizationUtilsRepoName,
                parents: [headRefShaMs]
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
            return github.pullRequests.create({
                base: "master",
                owner: LocalizationStringsUploader.ms,
                repo: LocalizationStringsUploader.localizationUtilsRepoName,
                head: "pbicvbot:master",
                title: "Localization strings update"
            });
        })
        .catch((error) => {
            console.log(error);
        });
    }

    public static async UploadStringsToAllRepos(updatedVisuals: IndexedFoldersSet, source: SourceType) {
        if (!Object.keys(updatedVisuals).length) {
            return null;
        }

        let promises: Promise<any>[] = [];

        let github: GitHubApi = new GitHubApi({
                    debug: true,
                    protocol: "https",
                    host: "api.github.com",
                    followRedirects: false,
                    timeout: 10000
                });

        github.authenticate({
            type: "oauth",
            token: LocalizationStringsUploader.token
        });

        for (let visualName in updatedVisuals) {
            let folders: IndexedObjects = updatedVisuals[visualName];

            let headRefSha: string,
                treeSha: string,
                commitSha: string;

            await github.gitdata.getReference({
                owner: LocalizationStringsUploader.ms,
                repo: visualName,
                ref: "heads/master"
            })
            .then((ref) => {       
                headRefSha = ref.data.object.sha;

                return github.gitdata.updateReference({
                    force: true,
                    ref: "heads/master",
                    owner: LocalizationStringsUploader.pbicvbot,
                    repo: visualName, 
                    sha: headRefSha
                });
            })
            .then(() => {
                return github.gitdata.getCommit({
                    owner: LocalizationStringsUploader.pbicvbot,
                    repo: visualName,
                    sha: headRefSha
                });
            })
            .then((commit) => {
                treeSha = commit.data.tree.sha;
                commitSha = commit.data.sha; 
            });
            
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
                            path: "stringResources/" + folderName + "/resources.json",
                            sha: blob.data.sha
                        }
                    }));
                }

                Promise
                    .all(promises)
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

                        return github.gitdata.createTree({
                            owner: LocalizationStringsUploader.pbicvbot,
                            repo: visualName,
                            base_tree: treeSha,
                            tree: JSON.stringify(treesArrays)
                        });
                    })
                    .then((newTree) => {
                        return github.gitdata.createCommit({
                            message: "updated localization strings",
                            tree: newTree.data.sha,
                            owner: LocalizationStringsUploader.pbicvbot,
                            repo: visualName,
                            parents: [headRefSha]
                        });
                    })
                    .then((ref) => {
                        return github.gitdata.updateReference({
                            force: true,
                            owner: LocalizationStringsUploader.pbicvbot,
                            repo: visualName,
                            ref: "heads/master",
                            sha: ref.data.sha
                        });
                    })
                    .then(() => {
                        return github.pullRequests.getAll({
                            owner: "mvgaliev",
                            repo: visualName 
                        })
                        .then((pullRequests) => {
                            let prExists: boolean = false;
                            for (let i in pullRequests.data) {
                                let pr = pullRequests.data[i];

                                if (pr.head.label === "pbicvbot:master") {
                                    return github.pullRequests.update({
                                        owner: "mvgaliev",
                                        repo: visualName,
                                        number: pr.number,
                                        state: "closed"
                                    });
                                }
                            }

                            return;
                        })
                        .then(() => {
                            return github.pullRequests.create({
                                base: "master",
                                owner: "mvgaliev",
                                repo: visualName,
                                head: "pbicvbot:master",
                                title: "Localization strings update"
                            });
                        })
                    });                                
            }            
        }
    }
}
