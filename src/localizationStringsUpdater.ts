import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet } from "./models";

export class LocalizationStringsUpdater {
    public static stringsToSkip: string[] = ["short_description", "long_description"];

    public static UpdateDestinationFolders(sourceVisuals: IndexedFoldersSet, destinationVisuals: IndexedFoldersSet): IndexedFoldersSet {
        const updatedVisuals: IndexedFoldersSet = new IndexedFoldersSet();

        for (const visualName in sourceVisuals) {

            const folders: IndexedObjects = sourceVisuals[visualName];

            for (const folderName in folders) {
                let sourceStrings: DisplayNameAndKeyPairs = folders[folderName],
                destinationStrings: DisplayNameAndKeyPairs = new DisplayNameAndKeyPairs(),
                isUpdated: boolean = false;

                if (!destinationVisuals[visualName] || !destinationVisuals[visualName][folderName]) {                                     
                    destinationStrings = sourceStrings;
                    isUpdated = true;   
                    console.log("added " + visualName + " " + folderName);
                } else {
                    destinationStrings = destinationVisuals[visualName][folderName];
                    for (const displayNameKey in sourceStrings) {

                        if (LocalizationStringsUpdater.stringsToSkip.indexOf(displayNameKey) !== -1) {
                            continue;
                        }

                        const displayName: string = sourceStrings[displayNameKey];
                        
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