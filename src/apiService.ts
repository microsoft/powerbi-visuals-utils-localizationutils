import { Octokit } from "@octokit/rest";

const visualsToParse = require('../repositories.json');
const config = require('../config.json');

export class ApiService { 
    private static api: Octokit;
    private static ms: string = "Microsoft";
    private static ownerName: string = config.ownerName;

    public static Create(): Octokit {
        if (!ApiService.api) {
            ApiService.api = new Octokit({
                protocol: "https",
                host: "api.github.com",
                timeout: 10000,
                headers: {
                    "encoding": "null"
                },
                auth: "token here"
            });

        }
        return ApiService.api;
    }

    public static async CreateBranchesIfNotExist(branchName: string) {
        for (const visualName in visualsToParse) { 
            if (visualsToParse[visualName]) { 
                const isBranchExists = await ApiService.IsBranchExists(branchName, visualName)

                if(!isBranchExists){
                    await ApiService.CreateBranch(branchName, visualName)
                }
            }
        }
    }

    public static async IsBranchExists(branchName: string, visualName: string): Promise<boolean> {
        const matchingRefs = await ApiService.api.rest.git.listMatchingRefs({
            owner: ApiService.ownerName,
            repo: visualName,
            ref: "heads/" + branchName
        })
        return matchingRefs.data.some(el => el.ref === `refs/heads/${branchName}`)
    }

    public static async CreateBranch(branchName: string, visualName: string) {
        const defaultBranchName: string = (await ApiService.api.rest.repos.get({
            owner: ApiService.ms,
            repo: visualName,
        })).data["default_branch"]
        
        const defaultBranchReference = await ApiService.api.rest.git.getRef({
            owner: ApiService.ms,
            repo: visualName,
            ref: `heads/${defaultBranchName}`
        })

        await ApiService.api.rest.git.createRef({
            owner: ApiService.ownerName,
            repo: visualName,
            ref: `refs/heads/${branchName}`,
            sha: defaultBranchReference.data.object.sha
        });
    }
    
    public static async GetDefaultBranchName(owner: string, repoName: string){
        const repo = await ApiService.api.rest.repos.get({
            owner,
            repo: repoName,
        })
        return repo.data["default_branch"]
    }
}