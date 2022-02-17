import { Octokit } from "@octokit/rest";

const config = require('../config.json');

export class GithubApiCreator { 
    private static github: Octokit;    
    private static token: string = <string>process.env.token;

    public static CreateGithubApi(): Octokit {
        if (!GithubApiCreator.github) {
            GithubApiCreator.github = new Octokit({
                protocol: "https",
                host: "api.github.com",
                timeout: 10000,
                auth: GithubApiCreator.token,
                headers: {
                    "encoding": "null"
                },
            });
        }
        console.log(GithubApiCreator.token)
        return GithubApiCreator.github;
    }
}