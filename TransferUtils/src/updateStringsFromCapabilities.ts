import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet, SourceType, SourceTarget, UpdateBranch } from "./models";
import { CapabilitiesParser } from "./capabilitiesParser";
import { JsonLoader } from "./jsonLoader";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { BranchCreator } from "./branchCreator";

class LocalizationStringsUtils {
    public static async Parse() {
        await BranchCreator.CreateBranchesIfNotExist(UpdateBranch.FromCapabilities);

        let sourceJsons: IndexedFoldersSet = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.Capabilities, SourceTarget.From),
            sourceStrings: IndexedFoldersSet = CapabilitiesParser.parseCapabilities(sourceJsons),
            destinationJsons: IndexedFoldersSet = await JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings, SourceTarget.To);

        let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(sourceStrings, destinationJsons);
        
        await LocalizationStringsUploader.UploadStringsToAllRepos(updatedVisuals, SourceType.Capabilities);                        
    }
}

LocalizationStringsUtils.Parse();