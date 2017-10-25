import * as GitHubApi from "github";
import { UpdateBranch } from "./models";
const data = require('../repositories.json');
import { GithubApiCreator } from "./githubApiCreator";

export class BranchCreator { 
    private static ms: string = "Microsoft";
    private static enUs: string = "en-US";
    private static pbicvbot: string = "pbicvbot";

    public static async CreateBranchesIfNotExist(branchName: string) {
        let github: GitHubApi = GithubApiCreator.CreateGithubApi(); 

        let locUpdateRefName: string = "refs/heads/" + branchName;

        for (let visualName in data) { 
            if (data[visualName]) { 
                await github.gitdata.getReferences({
                    owner: BranchCreator.pbicvbot,
                    repo: visualName
                })
                .then((refs) => {
                    let refExists: boolean = false;

                    refs.data.forEach((element: any) => {
                        if (element.ref === locUpdateRefName) {
                            refExists = true;
                            return;
                        }
                    });

                    return refExists;
                })
                .then((branchExists) => {
                    if (!branchExists) {
                        return github.gitdata.getReference({
                            owner: BranchCreator.ms,
                            repo: visualName,
                            ref: "heads/master"
                        })
                        .then((ref) => {
                            github.gitdata.createReference({
                                owner: BranchCreator.pbicvbot,
                                repo: visualName,
                                ref: locUpdateRefName,
                                sha: ref.data.object.sha
                            });
                        });                        
                    }
                });
            }
        }
    }
}