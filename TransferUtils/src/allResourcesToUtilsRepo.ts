import { DisplayNameAndKeyPairs, IndexedLocalizationStrings, IndexedObjects, SourceType, SourceTarget } from "./models";
import { CapabilitiesParser } from "./capabilitiesParser";
import { JsonLoader } from "./jsonLoader";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import * as GitHubApi from "github";

class LocalizationStringsUtils {
    public static async Parse() {
        let github: GitHubApi = LocalizationStringsUploader.CreateGithubApi(); 

        let prExists: boolean = await LocalizationStringsUploader.IsPullRequestExists(github, 
            LocalizationStringsUploader.ms, 
            LocalizationStringsUploader.localizationUtilsRepoName,
            "pbicvbot:master");

        if (!prExists) {
            await LocalizationStringsUploader.UpdateBranchFromMasterRepo(github, LocalizationStringsUploader.localizationUtilsRepoName, "heads/master");
        }

        let sourceJsons: IndexedObjects = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings, SourceTarget.From),
            destinationJsons: IndexedObjects = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.UtilsRepo, SourceTarget.To);

        let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(sourceJsons, destinationJsons);
        await LocalizationStringsUploader.UploadStringsToCommonRepo(updatedVisuals);                        
    }
}

LocalizationStringsUtils.Parse();