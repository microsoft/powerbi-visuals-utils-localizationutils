import { Octokit } from "@octokit/rest";
import { createActionAuth } from "@octokit/auth-action";

export class GithubApiCreator { 
    private static github: Octokit;

    public static CreateGithubApi(): Octokit {
        if (!GithubApiCreator.github) {
            GithubApiCreator.github = new Octokit({
                authStrategy: createActionAuth,
                protocol: "https",
                host: "api.github.com",
                timeout: 10000,
                headers: {
                    "encoding": "null"
                },
            });

        }
        
        return GithubApiCreator.github;
    }
}