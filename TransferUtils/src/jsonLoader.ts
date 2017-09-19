import { IndexedObjects, SourceType, UpdateType, IndexedFoldersSet } from './models';
import { RequestPromise, get } from "request-promise-native";
import * as GitHubApi from "github";
import { LocalizationStringsUploader } from "./localizationStringsUploader";

const data = require('../repositories.json');

export class JsonLoader {
    private static microsoftPath: string = "https://raw.githubusercontent.com/Microsoft/";
    private static pbicvbotPath: string = "https://raw.githubusercontent.com/pbicvbot/";
    private static localizationUtilsRepoName: string = "powerbi-visuals-utils-localizationutils";
    private static capabilities: string = "capabilities";
    private static microsoft: string = "Microsoft";
    private static pbicvbot: string = "pbicvbot";
    private static enUs: string = "en-US";
    private static token: string = <string>process.env.token;

    public static GetJsonByUrl(url: string) {
        return get({
            url: url
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

    public static async GetJsonsWithFoldersFromGithub(repoType: SourceType, updateType: UpdateType, forceMicrosoftMasterSource?: boolean, checkForExistingPullRequest?: boolean): Promise<IndexedFoldersSet> {
        let allPromises: Promise<any>[] = [];
        let visualNames: string[] = [];        

        let github: GitHubApi = new GitHubApi({
                    debug: true,
                    protocol: "https",
                    host: "api.github.com",
                    followRedirects: false,
                    timeout: 10000
                });

        github.authenticate({
            type: "oauth",
            token: JsonLoader.token
        });        

        for (let visualName in data) {
            if (data[visualName]) {
                let folderNames: string[] = [];

                if (checkForExistingPullRequest) {
                    let github: GitHubApi = LocalizationStringsUploader.CreateGithubApi(); 

                    let prExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(github, 
                        LocalizationStringsUploader.ms, 
                        visualName,
                        updateType === UpdateType.CapabilitiesToCv ? "pbicvbot:locUpdateCapabilities" : "pbicvbot:locUpdate");
                    
                    forceMicrosoftMasterSource = !prExists;
                }

                if (repoType === SourceType.Capabilities) {
                    folderNames[0] = JsonLoader.capabilities;
                } else if (updateType === UpdateType.UtilsToCv) {
                    folderNames = await JsonLoader.GetFolders(github, 
                        repoType === SourceType.UtilsRepo ? visualName : "stringResources", 
                        repoType === SourceType.UtilsRepo ? JsonLoader.localizationUtilsRepoName : visualName, 
                        repoType,
                        forceMicrosoftMasterSource);
                } else {
                    folderNames[0] = JsonLoader.enUs;
                }                

                for (let i in folderNames) {
                    let folder = folderNames[i];                    

                    let url: string = JsonLoader.BuildUrl(visualName, repoType, updateType, folder, forceMicrosoftMasterSource);
                    visualNames.push(visualName);

                    allPromises.push(
                        JsonLoader.GetJsonByUrl(url)
                        .then((response: Promise<Response>) => {
                            return {
                                visualName: visualName,
                                folderName: folder,
                                response: response
                            }
                        })
                    );
                }
            }
        }

        return Promise.all(allPromises).then((values) => {  
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
                return folders.data.filter((x: any) => x.name != "en-US").map((x: any) => x.name);
            } 
            return [];
        });
    }
}