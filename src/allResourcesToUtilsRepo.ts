import { DisplayNameAndKeyPairs, IndexedLocalizationStrings, IndexedObjects, SourceType, UpdateType } from "./models";
import { CapabilitiesParser } from "./capabilitiesParser";
import { JsonLoader } from "./jsonLoader";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import * as GitHubApi from "github";
import { GithubApiCreator } from "./githubApiCreator";

class LocalizationStringsUtils {
    public static async Parse() {
        let github: GitHubApi = GithubApiCreator.CreateGithubApi(); 

        let prExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(github, 
            LocalizationStringsUploader.ms, 
            LocalizationStringsUploader.localizationUtilsRepoName,
            "pbicvbot:master");

        if (!prExists) {
            await LocalizationStringsUploader.UpdateBranchFromMasterRepo(github, LocalizationStringsUploader.localizationUtilsRepoName, "heads/master");
        }

        let sourceJsons: Promise<IndexedObjects> = JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings, UpdateType.CvToUtils),
            destinationJsons: Promise<IndexedObjects> = JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.UtilsRepo, UpdateType.CvToUtils, !prExists, false);

        let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(await sourceJsons, await destinationJsons);
        await LocalizationStringsUploader.UploadStringsToCommonRepo(updatedVisuals);
    }
}

LocalizationStringsUtils.Parse();