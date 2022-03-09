import { IndexedObjects, SourceType, UpdateType } from "./models";
import { JsonLoader } from "./jsonLoader";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { Octokit } from "@octokit/rest";
import { ApiService } from "./apiService";

const config = require('../config.json');

class LocalizationStringsUtils {
    private static api: Octokit = ApiService.Create()
    private static ownerName: string = config.ownerName

    public static async Parse() {
        const mainRefName = await ApiService.GetDefaultBranchName(LocalizationStringsUploader.ms, LocalizationStringsUploader.mainRepoName)

        const isPullRequestExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(
            LocalizationStringsUploader.ms, 
            LocalizationStringsUploader.mainRepoName,
            `${LocalizationStringsUtils.ownerName}:${mainRefName}`
        );

        if (!isPullRequestExists) {
            await LocalizationStringsUploader.UpdateBranchFromMainRepo(
                LocalizationStringsUtils.api, 
                LocalizationStringsUploader.mainRepoName, 
                `heads/${mainRefName}`
            );
        }

        const sourceJsons: IndexedObjects = await JsonLoader.GetJsonsWithFolders(SourceType.LocalizationStrings, UpdateType.CvToUtils),
            destinationJsons: IndexedObjects = await JsonLoader.GetJsonsWithFolders(SourceType.UtilsRepo, UpdateType.CvToUtils, !isPullRequestExists);

        const updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(sourceJsons, destinationJsons);
        await LocalizationStringsUploader.UploadStringsToCommonRepo(updatedVisuals);
    }
}

LocalizationStringsUtils.Parse();