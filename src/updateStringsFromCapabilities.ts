import { IndexedObjects, IndexedFoldersSet, SourceType, UpdateType, UpdateBranch } from "./models";
import { CapabilitiesParser } from "./capabilitiesParser";
import { JsonLoader } from "./jsonLoader";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { ApiService } from "./apiService";

class LocalizationStringsUtils {
    public static async Parse() {
        await ApiService.CreateBranchesIfNotExist(UpdateBranch.FromCapabilities);

        const sourceJsons: IndexedFoldersSet = await JsonLoader.GetJsonsWithFolders(SourceType.Capabilities, UpdateType.CapabilitiesToCv),
            sourceStrings: IndexedFoldersSet = CapabilitiesParser.parseCapabilities(sourceJsons),
            destinationJsons: IndexedFoldersSet = await JsonLoader.GetJsonsWithFolders(SourceType.LocalizationStrings, UpdateType.CapabilitiesToCv, undefined, true);

        const updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(sourceStrings, destinationJsons);
        
        await LocalizationStringsUploader.UploadStringsToAllRepos(updatedVisuals, SourceType.Capabilities);
    }
}

LocalizationStringsUtils.Parse();