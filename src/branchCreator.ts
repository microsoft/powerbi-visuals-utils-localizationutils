import { Octokit } from "@octokit/rest";
const data = require('../repositories.json');
import { GithubApiCreator } from "./githubApiCreator";

export class BranchCreator { 
    private static ms: string = "Microsoft";
    private static enUs: string = "en-US";
    private static pbicvbot: string = "pbicvbot";

    public static async CreateBranchesIfNotExist(branchName: string) {
        let github: Octokit = GithubApiCreator.CreateGithubApi(); 

        let locUpdateRefName: string = "refs/heads/" + branchName;

        for (let visualName in data) { 
            if (data[visualName]) { 
                try {
                    return github.rest.git.getRef({
                        owner: BranchCreator.ms,
                        repo: visualName,
                        ref: "heads/master"
                    })
                    .then((ref) => {
                        github.rest.git.createRef({
                            owner: BranchCreator.pbicvbot,
                            repo: visualName,
                            ref: locUpdateRefName,
                            sha: ref.data.object.sha
                        });
                    });  
                } catch (error) {
                    console.log(error)
                }
            }
        }
    }
}