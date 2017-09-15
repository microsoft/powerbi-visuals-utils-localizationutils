import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet, SourceType } from "./models";
import { CapabilitiesParser } from "./capabilitiesParser";
import { JsonLoader } from "./jsonLoader";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { BranchCreator } from "./branchCreator";

class LocalizationStringsUtils {
    public static async Parse() {
        let sourceJsons: IndexedFoldersSet = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.Capabilities),
            sourceStrings: IndexedFoldersSet = CapabilitiesParser.parseCapabilities(sourceJsons),
            destinationJsons: IndexedFoldersSet = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings);

        let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(sourceStrings, destinationJsons);

        await BranchCreator.CreateBranchesIfNotExist();
        await LocalizationStringsUploader.UploadStringsToAllRepos(updatedVisuals, SourceType.Capabilities);                        
    }
}

LocalizationStringsUtils.Parse();