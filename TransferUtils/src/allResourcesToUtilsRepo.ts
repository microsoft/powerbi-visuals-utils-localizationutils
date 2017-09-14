import { DisplayNameAndKeyPairs, IndexedLocalizationStrings, IndexedObjects, SourceType } from "./models";
import { CapabilitiesParser } from "./capabilitiesParser";
import { JsonLoader } from "./jsonLoader";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";

class LocalizationStringsUtils {
    public static async Parse() {
        let sourceJsons: IndexedObjects = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings),
            destinationJsons: IndexedObjects = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.UtilsRepo);

        let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(sourceJsons, destinationJsons);
        await LocalizationStringsUploader.UploadStringsToCommonRepo(updatedVisuals);                        
    }
}

LocalizationStringsUtils.Parse();