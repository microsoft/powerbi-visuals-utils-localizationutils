import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet, SourceType, UpdateType, UpdateBranch } from "./models";
import { CapabilitiesParser } from "./capabilitiesParser";
import { JsonLoader } from "./jsonLoader";
import { LocalizationStringsUploader } from "./localizationStringsUploader";
import { LocalizationStringsUpdater } from "./localizationStringsUpdater";
import { BranchCreator } from "./branchCreator";

class LocalizationStringsUtils {
    public static async Parse() {
        await BranchCreator.CreateBranchesIfNotExist(UpdateBranch.FromCapabilities);

        let sourceJsons: Promise<IndexedFoldersSet> = JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.Capabilities, UpdateType.CapabilitiesToCv),
            sourceStrings: IndexedFoldersSet = CapabilitiesParser.parseCapabilities(await sourceJsons),
            destinationJsons: Promise<IndexedFoldersSet> = JsonLoader.GetJsonsWithFoldersFromGithub(SourceType.LocalizationStrings, UpdateType.CapabilitiesToCv, undefined, true);

        let updatedVisuals: IndexedObjects = LocalizationStringsUpdater.UpdateDestinationFolders(sourceStrings, await destinationJsons);
        
        await LocalizationStringsUploader.UploadStringsToAllRepos(updatedVisuals, SourceType.Capabilities);
    }
}

LocalizationStringsUtils.Parse();