import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { DisplayNameAndKeyPairs, IndexedObjects, SourceType, UpdateType, UpdateBranch } from "./models";
import { CapabilitiesParser } from "./capabilitiesParser";
import { JsonLoader } from "./jsonLoader";
import { BranchCreator } from "./branchCreator";

class LocalizationStringsUtils {
    public static async Parse() {
        //await BranchCreator.CreateBranchesIfNotExist(UpdateBranch.FromUtils);

        let sourceJsons: Promise<IndexedObjects> = JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.UtilsRepo, UpdateType.UtilsToCv);
        let destinationJsons: Promise<IndexedObjects> =  JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings, UpdateType.UtilsToCv, undefined, true);            

        let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(await sourceJsons, await destinationJsons);
        await LocalizationStringsUploader.UploadStringsToAllRepos(updatedVisuals, SourceType.UtilsRepo);      
    }
}

LocalizationStringsUtils.Parse();