import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { DisplayNameAndKeyPairs, IndexedObjects, SourceType, UpdateType, UpdateBranch } from "./models";
import { CapabilitiesParser } from "./capabilitiesParser";
import { JsonLoader } from "./jsonLoader";
import { BranchCreator } from "./branchCreator";

class LocalizationStringsUtils {
    public static async Parse() {
        //await BranchCreator.CreateBranchesIfNotExist(UpdateBranch.FromUtils);

        let sourceJsons: IndexedObjects = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.UtilsRepo, UpdateType.UtilsToCv);
        console.log("start: " + new Date().getSeconds());
        setTimeout(async () => {
            console.log("end " + new Date().getSeconds());
            let destinationJsons: IndexedObjects = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings, UpdateType.UtilsToCv, undefined, true);            

            let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders( sourceJsons,  destinationJsons);
            
            await LocalizationStringsUploader.UploadStringsToAllRepos(updatedVisuals, SourceType.UtilsRepo);
        }, 15000);        
    }
}

LocalizationStringsUtils.Parse();