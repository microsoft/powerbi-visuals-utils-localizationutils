import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet } from "./models";

export class LocalizationStringsUpdater {
    public static stringsToSkip: string[] = ["short_description", "long_description"];

    public static UpdateDestinationFolders(sourceVisuals: IndexedFoldersSet, destinationVisuals: IndexedFoldersSet): IndexedFoldersSet {
        let updatedVisuals: IndexedFoldersSet = new IndexedFoldersSet();

        for (let visualName in sourceVisuals) {

            let folders: IndexedObjects = sourceVisuals[visualName];

            for (let folderName in folders) {
                let sourceStrings: DisplayNameAndKeyPairs = folders[folderName],
                destinationStrings: DisplayNameAndKeyPairs = new DisplayNameAndKeyPairs(),
                isUpdated: boolean = false;

                if (!destinationVisuals[visualName] || !destinationVisuals[visualName][folderName]) {                                     
                    destinationStrings = sourceStrings;
                    isUpdated = true;   
                    console.log("added " + visualName + " " + folderName);
                } else {
                    destinationStrings = destinationVisuals[visualName][folderName];
                    for (let displayNameKey in sourceStrings) {

                        if (LocalizationStringsUpdater.stringsToSkip.indexOf(displayNameKey) !== -1) {
                            continue;
                        }

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