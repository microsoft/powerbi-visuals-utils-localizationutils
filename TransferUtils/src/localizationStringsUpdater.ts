import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet, SourceType } from "./models";

export class LocalizationStringsUpdater {
    public static UpdateDestinationFolders(indexedSourceStrings: IndexedFoldersSet, indexedDestinationJson: IndexedFoldersSet): IndexedFoldersSet {
        let updatedVisuals: IndexedFoldersSet = new IndexedFoldersSet();

        for (let visualName in indexedSourceStrings) {

            let folders: IndexedObjects = indexedSourceStrings[visualName];

            for (let folderName in folders) {
                let sourceStrings: DisplayNameAndKeyPairs = folders[folderName],
                destinationStrings: DisplayNameAndKeyPairs = new DisplayNameAndKeyPairs(),
                isUpdated: boolean = false;

                if (!indexedDestinationJson[visualName] || !indexedDestinationJson[visualName][folderName]) {                                     
                    destinationStrings = sourceStrings;
                    isUpdated = true;   
                    console.log("added " + visualName + " " + folderName);
                } else {
                    destinationStrings = indexedDestinationJson[visualName][folderName];
                    for (let displayNameKey in sourceStrings) {
                        let displayName: string = sourceStrings[displayNameKey];
                        
                        if (!destinationStrings[displayNameKey] || destinationStrings[displayNameKey] !== displayName) {
                            console.log("updated " + visualName + " " + folderName + " " + displayName)
                            destinationStrings[displayNameKey] = displayName;
                            isUpdated = true;
                        }
                    }
                }                

                if (isUpdated) {                    
                    if (!updatedVisuals[visualName]) {
                        updatedVisuals[visualName] = new IndexedObjects();
                    }
                    
                    updatedVisuals[visualName][folderName] = destinationStrings;
                }
            }           
        }

        return updatedVisuals;
    }
}