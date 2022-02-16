import { Octokit } from "@octokit/rest";
import { config } from "dotenv";

export class GithubApiCreator { 
    private static github: Octokit;    
    private static token: string = <string>process.env.token;

    public static CreateGithubApi(): Octokit {
        if (!GithubApiCreator.github) {
            config();
            GithubApiCreator.github = new Octokit({
                protocol: "https",
                host: "api.github.com",
                timeout: 10000,
                auth: process.env.token,
                headers: {
                    "encoding": "null"
                },
            });
        }

        return GithubApiCreator.github;
    }
}