import { IndexedObjects, SourceType, UpdateType } from "./models";
import { JsonLoader } from "./jsonLoader";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { Octokit } from "@octokit/rest";
import { GithubApiCreator } from "./githubApiCreator";

const config = require('../config.json');

class LocalizationStringsUtils {
    private static githubApi: Octokit = GithubApiCreator.CreateGithubApi()
    private static ownerName: string = config.ownerName

    private static async GetDefaultBranchName(owner: string, repoName: string){
        const repo = await LocalizationStringsUtils.githubApi.rest.repos.get({
            owner,
            repo: repoName,
        })
        return repo.data["default_branch"]
    }

    public static async Parse() {
        const mainRefName = await LocalizationStringsUtils.GetDefaultBranchName(LocalizationStringsUploader.ms, LocalizationStringsUploader.mainRepoName)

        let isPullRequestExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(
            LocalizationStringsUploader.ms, 
            LocalizationStringsUploader.mainRepoName,
            `${LocalizationStringsUtils.ownerName}:${mainRefName}`
        );

        if (!isPullRequestExists) {
            await LocalizationStringsUploader.UpdateBranchFromMainRepo(
                LocalizationStringsUtils.githubApi, 
                LocalizationStringsUploader.mainRepoName, 
                `heads/${mainRefName}`
            );
        }

        let sourceJsons: IndexedObjects = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings, UpdateType.CvToUtils),
            destinationJsons: IndexedObjects = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.UtilsRepo, UpdateType.CvToUtils, !isPullRequestExists);

        let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(sourceJsons, destinationJsons);
        await LocalizationStringsUploader.UploadStringsToCommonRepo(updatedVisuals);
    }
}

LocalizationStringsUtils.Parse();