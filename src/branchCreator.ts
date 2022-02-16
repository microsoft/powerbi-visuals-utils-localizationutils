import { Octokit } from "@octokit/rest";
import { GithubApiCreator } from "./githubApiCreator";

const visualsToParse = require('../repositories.json');
const config = require('../config.json');

export class BranchCreator { 
    private static ms: string = "Microsoft";
    private static ownerName: string = config.ownerName;

    public static async CreateBranchesIfNotExist(branchName: string) {
        let github: Octokit = GithubApiCreator.CreateGithubApi(); 

        let locUpdateRefName: string = "heads/" + branchName;

        for (let visualName in visualsToParse) { 
            if (visualsToParse[visualName]) { 
                await github.rest.git.listMatchingRefs({
                    owner: BranchCreator.ownerName,
                    repo: visualName,
                    ref: locUpdateRefName
                }).then((refs) => {
                    if(!refs.data.length){
                        github.rest.git.getRef({
                            owner: BranchCreator.ms,
                            repo: visualName,
                            ref: "heads/main"
                        })
                        .then((ref) => {
                            github.rest.git.createRef({
                                owner: BranchCreator.ownerName,
                                repo: visualName,
                                ref: locUpdateRefName,
                                sha: ref.data.object.sha
                            });
                        });
                    }
                })
            }
        }
    }
}