import { IndexedObjects, SourceType, UpdateType, IndexedFoldersSet } from './models';
import { RequestPromise, get } from "request-promise-native";
import * as GitHubApi from "github";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { GithubApiCreator } from "./githubApiCreator";
import { LoaderUtils } from "./loaderUtils"; 
import * as fs from "fs";
import * as Path from "path";

const data = require('../repositories.json');

export class JsonLoader {
    private static microsoftPath: string = "https://raw.githubusercontent.com/Microsoft/";
    private static pbicvbotPath: string = "https://raw.githubusercontent.com/pbicvbot/";
    private static localizationUtilsRepoName: string = "powerbi-visuals-utils-localizationutils";
    private static capabilities: string = "capabilities";
    private static microsoft: string = "Microsoft";
    private static pbicvbot: string = "pbicvbot";
    private static enUs: string = "en-US";

    public static GetJsonByUrl(url: string) {
        return get({
            url: url,
            timeout: 600000,
            encoding: null
        });
    }

    private static BuildUrl(visualName: string, type: SourceType, updateType: UpdateType, folder?: string, forceMicrosoftMasterSource?: boolean): string {
        
        let repoPath: string = forceMicrosoftMasterSource || (updateType === UpdateType.CvToUtils && type === SourceType.LocalizationStrings) ? JsonLoader.microsoftPath : JsonLoader.pbicvbotPath;

        if (type === SourceType.Capabilities) {
            return JsonLoader.microsoftPath + visualName + "/master/capabilities.json";
        } else if (type === SourceType.UtilsRepo) {
            return repoPath
            + JsonLoader.localizationUtilsRepoName
            + "/master/"
            + visualName
            + (folder ? "/" + folder + "/resources.resjson" : "/en-US/resources.resjson");
        }

        return repoPath
            + visualName
            + (forceMicrosoftMasterSource || updateType === UpdateType.CvToUtils ? "/master/stringResources/" :
                                updateType === UpdateType.CapabilitiesToCv ?
                                    "/locUpdateCapabilities/stringResources/" : "/locUpdate/stringResources/")
            + (folder ? folder : JsonLoader.enUs)
            + "/resources.resjson";
    }

    private static async GetJsonsUtilsToCv(repoType: SourceType, updateType: UpdateType, forceMicrosoftMasterSource?: boolean, checkForExistingPullRequest?: boolean): Promise<IndexedFoldersSet> { 
        if (repoType === SourceType.UtilsRepo) {
            return JsonLoader.GetJsonsFromUtils( 
                        JsonLoader.localizationUtilsRepoName, 
                        repoType);
        }

        return JsonLoader.GetJsonsFromRepos(JsonLoader.localizationUtilsRepoName, 
                        repoType);        
    }

    private static async GetJsons(repoType: SourceType, updateType: UpdateType, forceMicrosoftMasterSource?: boolean, checkForExistingPullRequest?: boolean): Promise<IndexedFoldersSet> {
        let visualNames: string[] = [];
        let allPromises: any[] = [];

        for (let visualName in data) {
            if (data[visualName]) {
                let folderNames: string[] = [];

                if (checkForExistingPullRequest) {
                    let prExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(JsonLoader.microsoft, 
                        visualName,
                        updateType === UpdateType.CapabilitiesToCv ? "pbicvbot:locUpdateCapabilities" : "pbicvbot:locUpdate");
                    
                    forceMicrosoftMasterSource = !prExists;
                }

                if (repoType === SourceType.Capabilities) {
                    folderNames[0] = JsonLoader.capabilities;
                } else {
                    folderNames[0] = JsonLoader.enUs;
                }                

                folderNames = folderNames.filter(x => x !== "qps-ploc");

                for (let i in folderNames) {
                    let folder = folderNames[i];                    

                    let url: string = JsonLoader.BuildUrl(visualName, repoType, updateType, folder, forceMicrosoftMasterSource);
                    visualNames.push(visualName);

                    allPromises.push(
                        await JsonLoader.GetJsonByUrl(url)
                        .then((response: Promise<Response>) => {
                            console.log("received from " + url + " path");
                            return {
                                visualName: visualName,
                                folderName: folder,
                                response: response
                            }
                        })
                        .catch((rej) => {
                            console.log("Get error url: " + url + ": " + rej);
                        })
                    );
                }
            }
        }

        return Promise.all(allPromises)
            .then((values) => {  
                let allJsons: IndexedFoldersSet = {}; 

                for (let i in values) {
                        let val = values[i];
                        console.log("Visual " + val.visualName + " prepared for parsing");

                        // remove byte order mark from json string. Found in linedotchart
                        let val1 = val.response.toString().replace('\uFEFF', '');
                        
                        if (!allJsons[val.visualName]) {
                            allJsons[val.visualName] = new IndexedObjects();
                        }

                        allJsons[val.visualName][val.folderName] = JSON.parse(val1);
                        
                        console.log("Visual " + val.visualName + " " + val.folderName + " successfully parsed");
                    
                }
                
                return allJsons;
            }).catch((reject) => {
                console.log("Get jsons from github failed: " + reject);
                throw reject;
            });
    }

    public static async GetJsonsWithFoldersFromGithub(repoType: SourceType, updateType: UpdateType, forceMicrosoftMasterSource?: boolean, checkForExistingPullRequest?: boolean): Promise<IndexedFoldersSet> {

        let github: GitHubApi = GithubApiCreator.CreateGithubApi();

        if (updateType === UpdateType.UtilsToCv) {
            return JsonLoader.GetJsonsUtilsToCv(repoType, updateType, forceMicrosoftMasterSource, checkForExistingPullRequest);
        }

        return JsonLoader.GetJsons(repoType, updateType, forceMicrosoftMasterSource, checkForExistingPullRequest);        
    }

    private static async GetJsonsFromRepo(path: string, repo: string, type: SourceType, forceMicrosoftMasterSource?: boolean): Promise<IndexedFoldersSet> {
        let owner: string = type !== SourceType.LocalizationStrings || forceMicrosoftMasterSource ? JsonLoader.microsoft : JsonLoader.pbicvbot;
        let ref: string = type !== SourceType.LocalizationStrings || forceMicrosoftMasterSource ? "heads/master" : "heads/locUpdate";

        let folder: string =  Path.join("dist");
        let fileName: string = repo + ".tar.gz";
        let filePath: string = folder + "/" + fileName;

        return GithubApiCreator.CreateGithubApi().repos.getArchiveLink({
            archive_format: "tarball",
            owner: owner,
            ref: ref,
            repo: repo
        })
        .then((data) => {
            return JsonLoader.GetJsonByUrl(data.meta.location).promise();
        })
        .then((targz) => {
            return LoaderUtils.ExtractTargz(targz, filePath, folder);
        })
        .then(() => {
            let rootFolder = Path.join("dist", fs.readdirSync("dist")
                .filter(directory => fs.lstatSync(Path.join("dist", directory)).isDirectory() && directory.indexOf(repo) > 0)[0]);

            let visualFolderPath: string = Path.join(rootFolder, "stringResources");

            let obj: any = {};
            obj[repo] = LoaderUtils.GetIndexedObjects(visualFolderPath, true);

            return obj;
        });
    }

    private static async GetJsonsFromRepos( repo: string, 
                                            repoType: SourceType, 
                                            checkForExistingPullRequest?: boolean, 
                                            forceMicrosoftMasterSource?: boolean): Promise<IndexedFoldersSet> {
        
        let allPromises: Promise<IndexedObjects>[] = [];

        for (let visualName in data) {
            if (data[visualName]) {
                if (checkForExistingPullRequest) {
                    let prExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(JsonLoader.microsoft, 
                        visualName,
                        "pbicvbot:locUpdate");
                    
                    forceMicrosoftMasterSource = !prExists;
                }

                allPromises.push(JsonLoader.GetJsonsFromRepo("stringResources", visualName, repoType, forceMicrosoftMasterSource));
            }
        }

        return Promise.all(allPromises)
            .then((foldersSets) => {
                let foldersSet: IndexedFoldersSet = {};

                for (let i in foldersSets) {
                    for (let visualName in foldersSets[i]) {
                        foldersSet[visualName] = foldersSets[i][visualName];
                    }
                }

                return foldersSet;
            });
    }

    private static async GetJsonsFromUtils(repo: string, type: SourceType): Promise<IndexedFoldersSet> {
        let owner: string = JsonLoader.microsoft;
        let ref: string = "heads/master";

        let folder: string = "dist";
        let fileName: string = "localizationUtils.tar.gz";
        let filePath: string = folder + "/" + fileName;

        return GithubApiCreator.CreateGithubApi().repos.getArchiveLink({
            archive_format: "tarball",
            owner: owner,
            ref: ref,
            repo: repo
        })
        .then((data) => {
            return JsonLoader.GetJsonByUrl(data.meta.location).promise();
        })
        .then((targz) => {
            return LoaderUtils.ExtractTargz(targz, filePath, folder);
        })
        .then(() => {
            let foldersSet: IndexedFoldersSet = {}; 

            let locUtils: string = fs.readdirSync("dist")
                .filter(directory => fs.lstatSync(Path.join("dist", directory)).isDirectory() && directory.indexOf("localizationutils") > 0)[0];

            let rootFolder = Path.join("dist", locUtils);
            
            let jsonPaths: IndexedFoldersSet = new IndexedFoldersSet();

            for (let visualName in data) {
                if (data[visualName]) {
                    let visualFolderPath: string = Path.join(rootFolder, visualName);
                    foldersSet[visualName] = LoaderUtils.GetIndexedObjects(visualFolderPath, true);
                }
            }

            return foldersSet;
        });
    }

    private static async GetFolders(github: GitHubApi, path: string, repo: string, type: SourceType, forceMicrosoftMasterSource?: boolean): Promise<string[]> {
        let owner: string = type !== SourceType.LocalizationStrings || forceMicrosoftMasterSource ? JsonLoader.microsoft : JsonLoader.pbicvbot;
        let ref: string = type !== SourceType.LocalizationStrings || forceMicrosoftMasterSource ? "heads/master" : "heads/locUpdate";

        return github.repos.getContent({
            owner: owner,
            path: path,
            repo: repo,
            ref: ref
        })
        .then((folders): string[] => {
            if (folders && folders.data.length && folders.data[0].name) {
                return folders.data.filter((x: any) => x.name != "en-US" && x.type === "dir").map((x: any) => x.name);
            } 
            return [];
        });
    }
}