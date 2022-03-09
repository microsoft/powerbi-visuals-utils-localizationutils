import { IndexedObjects, SourceType, UpdateType, IndexedFoldersSet } from './models';
import { get } from "request-promise-native";
import { Octokit } from "@octokit/rest";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { ApiService } from "./apiService";
import { LoaderUtils } from "./loaderUtils"; 
import * as fs from "fs";
import * as Path from "path";

const visualsToParse = require('../repositories.json');
const config = require('../config.json');

export class JsonLoader {
    private static microsoftPath: string = "https://raw.githubusercontent.com/Microsoft/";
    private static pbicvbotPath: string = "https://raw.githubusercontent.com/pbicvbot/";
    private static mainRepoName: string = config.repoName;
    private static capabilities: string = "capabilities";
    private static microsoft: string = "Microsoft";
    private static ownerName: string = config.ownerName;
    private static enUs: string = "en-US";
    private static api: Octokit = ApiService.Create();

    public static GetJsonByUrl(url: string) {
        return get({
            url: url,
            timeout: 600000,
            encoding: null
        });
    }
    
    private static async BuildUrl(visualName: string, type: SourceType, updateType: UpdateType, folder?: string, forceMicrosoftMainSource?: boolean): Promise<string> {
        
        const repoPath: string = forceMicrosoftMainSource || (updateType === UpdateType.CvToUtils && type === SourceType.LocalizationStrings) 
            ? JsonLoader.microsoftPath 
            : JsonLoader.pbicvbotPath;

        if (type === SourceType.Capabilities) {
            return JsonLoader.microsoftPath + visualName + "/main/capabilities.json";
        } else if (type === SourceType.UtilsRepo) {
            return repoPath
            + JsonLoader.mainRepoName
            + "/main/"
            + visualName
            + (folder ? `/${folder}/resources.resjson` : "/en-US/resources.resjson");
        }

        return repoPath
            + visualName
            + (
                forceMicrosoftMainSource || updateType === UpdateType.CvToUtils 
                ? "/main/stringResources/" 
                : (
                    updateType === UpdateType.CapabilitiesToCv 
                    ? "/locUpdateCapabilities/stringResources/" 
                    : "/locUpdate/stringResources/"
                )
            )
            + (folder ? folder : JsonLoader.enUs)
            + "/resources.resjson";
    }

    private static async GetJsonsUtilsToCv(repoType: SourceType, checkForExistingPullRequest?: boolean): Promise<IndexedFoldersSet> { 
        if (repoType === SourceType.UtilsRepo) {
            return JsonLoader.GetJsonsFromUtils(JsonLoader.mainRepoName);
        }

        return JsonLoader.GetJsonsFromRepos(repoType, checkForExistingPullRequest);        
    }

    private static async GetJsons(
        repoType: SourceType, 
        updateType: UpdateType, 
        forceMicrosoftMainSource?: boolean, 
        checkForExistingPullRequest?: boolean
    ): Promise<IndexedFoldersSet> {
        const visualNames: string[] = [];
        const allPromises: any[] = [];

        for (const visualName in visualsToParse) {
            if (visualsToParse[visualName]) {
                let folderNames: string[] = [];

                if (checkForExistingPullRequest) {
                    const isPullRequestExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(
                        JsonLoader.microsoft, 
                        visualName,
                        `${this.ownerName}:${updateType === UpdateType.CapabilitiesToCv ? "locUpdateCapabilities" : "locUpdate"}`
                    );
                    
                    forceMicrosoftMainSource = !isPullRequestExists;
                }

                if (repoType === SourceType.Capabilities) {
                    folderNames[0] = JsonLoader.capabilities;
                } else {
                    folderNames[0] = JsonLoader.enUs;
                }                

                folderNames = folderNames.filter(x => x !== "qps-ploc");

                for (const i in folderNames) {
                    const folder = folderNames[i];                    

                    const url: string = await JsonLoader.BuildUrl(visualName, repoType, updateType, folder, forceMicrosoftMainSource);
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
                const allJsons: IndexedFoldersSet = {}; 

                for (const i in values) {
                        const val = values[i];
                        console.log("Visual " + val.visualName + " prepared for parsing");

                        // remove byte order mark from json string. Found in linedotchart
                        const val1 = val.response.toString().replace('\uFEFF', '');
                        
                        if (!allJsons[val.visualName]) {
                            allJsons[val.visualName] = new IndexedObjects();
                        }

                        allJsons[val.visualName][val.folderName] = JSON.parse(val1);
                        
                        console.log("Visual " + val.visualName + " " + val.folderName + " successfully parsed");
                    
                }
                
                return allJsons;
            }).catch((reject) => {
                console.log("Get jsons failed: " + reject);
                throw reject;
            });
    }

    public static async GetJsonsWithFolders(
        repoType: SourceType, 
        updateType: UpdateType, 
        forceMicrosoftMainSource?: boolean, 
        checkForExistingPullRequest?: boolean
    ): Promise<IndexedFoldersSet> {

        if (updateType === UpdateType.UtilsToCv) {
            return JsonLoader.GetJsonsUtilsToCv(repoType, checkForExistingPullRequest);
        }

        return JsonLoader.GetJsons(repoType, updateType, forceMicrosoftMainSource, checkForExistingPullRequest);        
    }

    private static async GetJsonsFromRepo(repo: string, type: SourceType, forceMicrosoftMainSource?: boolean): Promise<IndexedFoldersSet> {
        const owner: string = type !== SourceType.LocalizationStrings || forceMicrosoftMainSource ? JsonLoader.microsoft : JsonLoader.ownerName;

        const defaultBranchName = await ApiService.GetDefaultBranchName(owner, repo)
        const ref: string = type !== SourceType.LocalizationStrings || forceMicrosoftMainSource ? `heads/${defaultBranchName}` : "heads/locUpdate";

        const folder: string =  Path.join("dist");
        const fileName: string = repo + ".tar.gz";
        const filePath: string = folder + "/" + fileName;

        const data = await this.api.rest.repos.downloadTarballArchive({
            owner: owner,
            ref: ref,
            repo: repo
        })

        const targz = await JsonLoader.GetJsonByUrl(data.url).promise()
        await LoaderUtils.ExtractTargz(targz, filePath)
        
        const rootFolder = Path.join(
            "dist", 
            fs.readdirSync("dist").filter(
                currentDirectory => fs.lstatSync(Path.join("dist", currentDirectory)).isDirectory() && currentDirectory.indexOf(repo) > 0
            )[0]
        );

        const obj: any = {};

        const visualFolderPath: string = Path.join(rootFolder, "stringResources");
        obj[repo] = LoaderUtils.GetIndexedObjects(visualFolderPath, true);

        return obj;
    }

    private static async GetJsonsFromRepos(
        repoType: SourceType,
        checkForExistingPullRequest?: boolean, 
        forceMicrosoftMainSource?: boolean
    ): Promise<IndexedFoldersSet> {
        
        const allPromises: Promise<IndexedObjects>[] = [];

        for (const visualName in visualsToParse) {
            if (visualsToParse[visualName]) {
                if (checkForExistingPullRequest) {
                    const isPullRequestExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(JsonLoader.microsoft, 
                        visualName,
                        `${JsonLoader.ownerName}:locUpdate`);
                    
                    forceMicrosoftMainSource = !isPullRequestExists;
                }

                allPromises.push(JsonLoader.GetJsonsFromRepo(visualName, repoType, forceMicrosoftMainSource));
            }
        }

        return Promise.all(allPromises)
            .then((foldersSets) => {
                const foldersSet: IndexedFoldersSet = {};

                for (const i in foldersSets) {
                    for (const visualName in foldersSets[i]) {
                        foldersSet[visualName] = foldersSets[i][visualName];
                    }
                }

                return foldersSet;
            });
    }

    private static async GetJsonsFromUtils(repo: string): Promise<IndexedFoldersSet> {
        const folder: string = "dist";
        const fileName: string = "localizationUtils.tar.gz";
        const filePath: string = folder + "/" + fileName;
        const defaultBranchName = await ApiService.GetDefaultBranchName(this.ownerName, repo)

        const data = await this.api.rest.repos.downloadTarballArchive({
            owner: this.ownerName,
            ref: defaultBranchName,
            repo: repo
        })

        const targz = await JsonLoader.GetJsonByUrl(data.url).promise();
        await LoaderUtils.ExtractTargz(targz, filePath);

        const foldersSet: IndexedFoldersSet = {}; 

        const locUtils: string = fs.readdirSync("dist").filter(
            directory => fs.lstatSync(Path.join("dist", directory)).isDirectory() && directory.indexOf("localizationutils") > 0
        )[0];

        const rootFolder = Path.join("dist", locUtils);

        for (const visualName in visualsToParse) {
            if (visualsToParse[visualName]) {
                const visualFolderPath: string = Path.join(rootFolder, visualName);
                foldersSet[visualName] = LoaderUtils.GetIndexedObjects(visualFolderPath, true);
            }
        }

        return foldersSet;
    }

    private static async GetFolders(api: Octokit, path: string, repo: string, type: SourceType, forceMicrosoftMainSource?: boolean): Promise<string[]> {
        const owner: string = type !== SourceType.LocalizationStrings || forceMicrosoftMainSource ? JsonLoader.microsoft : JsonLoader.ownerName;
        
        const defaultBranchName = await ApiService.GetDefaultBranchName(repo, owner)
        const ref: string = type !== SourceType.LocalizationStrings || forceMicrosoftMainSource ? `heads/${defaultBranchName}` : "heads/locUpdate";

        const { data } = await api.rest.repos.getContent({
            owner: owner,
            path: path,
            repo: repo,
            ref: ref
        })
        if (!Array.isArray(data)) {
            return [];
        }
    
        for (const item of data) {
            console.log(item)
        }
        
        return data.filter((x: any) => x.name != "en-US" && x.type === "dir").map((x: any) => x.name);
    }
}