import * as GitHubApi from "github";

export class GithubApiCreator { 
    private static github: GitHubApi;    
    private static token: string = <string>process.env.token;

    public static CreateGithubApi(): GitHubApi {
        if (!GithubApiCreator.github) {
            GithubApiCreator.github = new GitHubApi({
                    debug: false,
                    protocol: "https",
                    host: "api.github.com",
                    followRedirects: false,
                    timeout: 10000
                });

            GithubApiCreator.github.authenticate({
                type: "oauth",
                token: GithubApiCreator.token
            });
        }

        return GithubApiCreator.github;
    }
}