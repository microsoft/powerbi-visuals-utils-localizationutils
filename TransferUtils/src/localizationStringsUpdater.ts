import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet, SourceType } from "./models";

export class LocalizationStringsUpdater {
    public static UpdateDestinationJson(indexedSourceStrings: IndexedObjects, indexedDestinationJson: IndexedObjects): IndexedObjects {
        let updatedVisuals: IndexedObjects = new IndexedObjects();

        for (let visualName in indexedSourceStrings) {
            let sourceStrings: DisplayNameAndKeyPairs = indexedSourceStrings[visualName],
                destinationStrings: DisplayNameAndKeyPairs = indexedDestinationJson[visualName],
                isUpdated: boolean = false;

            for (let displayNameKey in sourceStrings) {
                let displayName: string = sourceStrings[displayNameKey];

                if (!destinationStrings[displayNameKey] || destinationStrings[displayNameKey] !== displayName) {
                    console.log("updated " + visualName + " " + displayName)
                    destinationStrings[displayNameKey] = displayName;
                    isUpdated = true;
                }
            }

            if (isUpdated) {
                updatedVisuals[visualName] = destinationStrings;
            }
        }

        return updatedVisuals;
    }

    public static UpdateDestinationFolders(indexedSourceStrings: IndexedFoldersSet, indexedDestinationJson: IndexedFoldersSet): IndexedFoldersSet {
        let updatedVisuals: IndexedFoldersSet = new IndexedFoldersSet();

        for (let visualName in indexedSourceStrings) {

            let folders: IndexedObjects = indexedSourceStrings[visualName];

            for (let folderName in folders) {
                let sourceStrings: DisplayNameAndKeyPairs = folders[folderName],
                destinationStrings: DisplayNameAndKeyPairs = indexedDestinationJson[visualName][folderName],
                isUpdated: boolean = false;

                if (!destinationStrings) {                                     
                    destinationStrings = sourceStrings;
                    isUpdated = true;   
                    console.log("added " + visualName + " " + folderName);
                } else {
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