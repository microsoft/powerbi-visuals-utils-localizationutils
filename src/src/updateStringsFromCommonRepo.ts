import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { DisplayNameAndKeyPairs, IndexedObjects, SourceType } from "./models";
import { CapabilitiesParser } from "./capabilitiesParser";
import { JsonLoader } from "./jsonLoader";

class LocalizationStringsUtils {
    public static async Parse() {
        let sourceJsons: IndexedObjects = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.UtilsRepo),
            destinationJsons: IndexedObjects = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings);

        let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(sourceJsons, destinationJsons);
        await LocalizationStringsUploader.UploadStringsToAllRepos(updatedVisuals, SourceType.UtilsRepo);                        
    }
}

LocalizationStringsUtils.Parse();