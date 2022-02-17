import { IndexedObjects, SourceType, UpdateType } from "./models";
import { JsonLoader } from "./jsonLoader";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { Octokit } from "@octokit/rest";
import { GithubApiCreator } from "./githubApiCreator";

const config = require('../config.json');

class LocalizationStringsUtils {
    private static githubApi: Octokit = GithubApiCreator.CreateGithubApi()

    public static async Parse() {
        const mainRefName = await this.githubApi.rest.git.listMatchingRefs({
            owner: LocalizationStringsUploader.ms,
            repo: LocalizationStringsUploader.localizationUtilsRepoName,
            ref: "heads/main"
        }).then(refs => refs.data.length ? "main" : "master")

        let prExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(LocalizationStringsUploader.ms, 
            LocalizationStringsUploader.localizationUtilsRepoName,
            `${config.ownerName}:${mainRefName}`);

        if (!prExists) {
            await LocalizationStringsUploader.UpdateBranchFromMasterRepo(this.githubApi, LocalizationStringsUploader.localizationUtilsRepoName, `heads/master`);
        }

        let sourceJsons: Promise<IndexedObjects> = JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings, UpdateType.CvToUtils),
            destinationJsons: Promise<IndexedObjects> = JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.UtilsRepo, UpdateType.CvToUtils, !prExists, false);

        let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(await sourceJsons, await destinationJsons);
        await LocalizationStringsUploader.UploadStringsToCommonRepo(updatedVisuals);
    }
}

LocalizationStringsUtils.Parse();