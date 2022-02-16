import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { IndexedObjects, SourceType, UpdateType } from "./models";
import { JsonLoader } from "./jsonLoader";

class LocalizationStringsUtils {
    public static async Parse() {

        let sourceJsons: IndexedObjects = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.UtilsRepo, UpdateType.UtilsToCv);
        let destinationJsons: IndexedObjects =  await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings, UpdateType.UtilsToCv, undefined, true);            

        let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(sourceJsons, destinationJsons);
        await LocalizationStringsUploader.UploadStringsToAllRepos(updatedVisuals, SourceType.UtilsRepo);      
    }
}

LocalizationStringsUtils.Parse();