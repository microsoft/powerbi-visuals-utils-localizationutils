import { IndexedObjects, SourceType, IndexedFoldersSet } from './models';
import { RequestPromise, get } from "request-promise-native";
import * as GitHubApi from "github";

const data = require('../repositories.json');

export class JsonLoader {
    private static microsoftPath: string = "https://raw.githubusercontent.com/Microsoft/";
    private static localizationUtilsRepoName: string = "powerbi-visuals-utils-localizationutils";
    private static capabilities: string = "capabilities";
    private static microsoft: string = "Microsoft";
    private static enUs: string = "en-US";
    private static token: string = <string>process.env.token;

    public static GetJsonByUrl(url: string) {
        return get({
            url: url
        });
    }

    private static BuildUrl(visualName: string, type: SourceType, folder?: string): string {
        if (type === SourceType.Capabilities) {
            return JsonLoader.microsoftPath + visualName + "/master/capabilities.json";
        } else if (type === SourceType.UtilsRepo) {
            return JsonLoader.microsoftPath + JsonLoader.localizationUtilsRepoName + "/master/" 
            + visualName 
            + (folder ? "/" + folder + "/resources.resjson" : "/en-US/resources.resjson");
        }

        return JsonLoader.microsoftPath
            + visualName 
            + "/master/stringResources/" 
            + (folder ? folder : JsonLoader.enUs) 
            + "/resources.resjson";   
    }

    public static async GetJsonsFromGithub(repoType: SourceType): Promise<IndexedObjects> {
        let allRequests: RequestPromise[] = [];
        let visualNames: string[] = [];

        for (let visualName in data) {
            if (data[visualName]) {
                let url: string = JsonLoader.BuildUrl(visualName, repoType);
                visualNames.push(visualName);
                allRequests.push(JsonLoader.GetJsonByUrl(url));
            }
        }
        
        return Promise.all(allRequests).then((value) => {
            let allJsons: IndexedObjects = new IndexedObjects();
            
            value.forEach((val, index) => {
                let key: string = visualNames[index];

                console.log("Visual " + key + " prepared for parsing");

                // remove byte order mark from json string. Found in linedotchart
                let val1 = val.replace('\uFEFF', '');
                
                allJsons[key] = JSON.parse(val1);

                console.log("Visual " + key + " successfully parsed");
            });

            return allJsons;
        }).catch((reject) => {
            console.log("Get jsons from github failed: " + reject);
            throw reject;
        });
    }

    public static async GetJsonsWithFoldersFromGithub(repoType: SourceType): Promise<IndexedFoldersSet> {
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

                if (repoType === SourceType.Capabilities) {
                    folderNames[0] = JsonLoader.capabilities;
                } else if (repoType === SourceType.UtilsRepo) {                 
                     folderNames = await github.repos.getContent({
                        owner: JsonLoader.microsoft,
                        path: visualName,
                        repo: JsonLoader.localizationUtilsRepoName 
                    })
                    .then((folders): string[] => {
                        if (folders && folders.data.length && folders.data[0].name) {
                            return folders.data.map((x: any) => x.name);
                        } 
                        return [];
                    });
                } else {
                    folderNames[0] = JsonLoader.enUs;
                }

                for (let i in folderNames) {
                    let folder = folderNames[i];

                    let url: string = JsonLoader.BuildUrl(visualName, repoType, folder);
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
}