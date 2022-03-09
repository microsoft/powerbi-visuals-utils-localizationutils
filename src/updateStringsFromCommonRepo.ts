import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { IndexedObjects, SourceType, UpdateType } from "./models";
import { JsonLoader } from "./jsonLoader";

class LocalizationStringsUtils {
    public static async Parse() {

        const sourceJsons: IndexedObjects = await JsonLoader.GetJsonsWithFolders(SourceType.UtilsRepo, UpdateType.UtilsToCv);
        const destinationJsons: IndexedObjects =  await JsonLoader.GetJsonsWithFolders(SourceType.LocalizationStrings, UpdateType.UtilsToCv, undefined, true);            

        const updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(sourceJsons, destinationJsons);
        await LocalizationStringsUploader.UploadStringsToAllRepos(updatedVisuals, SourceType.UtilsRepo);      
    }
}

LocalizationStringsUtils.Parse();