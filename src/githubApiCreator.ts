import { Octokit } from "@octokit/rest";

export class GithubApiCreator { 
    private static github: Octokit;    
    private static token: string = <string>process.env.token;

    public static CreateGithubApi(): Octokit {
        if (!GithubApiCreator.github) {
            GithubApiCreator.github = new Octokit({
                protocol: "https",
                host: "api.github.com",
                timeout: 10000,
                headers: {
                    "encoding": "null"
                }
            });

            GithubApiCreator.github.auth({
                type: "oauth",
                token: GithubApiCreator.token
            });
        }

        return GithubApiCreator.github;
    }
}