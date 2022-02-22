import { Octokit } from "@octokit/rest";
import { GithubApiCreator } from "./githubApiCreator";

const visualsToParse = require('../repositories.json');
const config = require('../config.json');

export class BranchCreator { 
    private static ms: string = "Microsoft";
    private static ownerName: string = config.ownerName;
    private static githubApi: Octokit = GithubApiCreator.CreateGithubApi();

    public static async CreateBranchesIfNotExist(branchName: string) {
        for (let visualName in visualsToParse) { 
            if (visualsToParse[visualName]) { 
                const isBranchExists = await BranchCreator.IsBranchExists(branchName, visualName)

                if(!isBranchExists){
                    await BranchCreator.CreateBranch(branchName, visualName)
                }
            }
        }
    }

    public static async IsBranchExists(branchName: string, visualName: string): Promise<boolean> {
        const matchingRefs = await BranchCreator.githubApi.rest.git.listMatchingRefs({
            owner: BranchCreator.ownerName,
            repo: visualName,
            ref: "heads/" + branchName
        })
        return matchingRefs.data.some(el => el.ref === `refs/heads/${branchName}`)
    }

    public static async CreateBranch(branchName: string, visualName: string) {
        const defaultBranchName: string = (await BranchCreator.githubApi.rest.repos.get({
            owner: BranchCreator.ms,
            repo: visualName,
        })).data["default_branch"]
        
        const defaultBranchReference = await BranchCreator.githubApi.rest.git.getRef({
            owner: BranchCreator.ms,
            repo: visualName,
            ref: `heads/${defaultBranchName}`
        })

        await BranchCreator.githubApi.rest.git.createRef({
            owner: BranchCreator.ownerName,
            repo: visualName,
            ref: `refs/heads/${branchName}`,
            sha: defaultBranchReference.data.object.sha
        });
    }
}