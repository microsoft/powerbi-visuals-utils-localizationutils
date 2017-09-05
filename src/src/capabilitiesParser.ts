import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet } from './models';

export class CapabilitiesParser {
    public static parseCapabilities(jsons: IndexedFoldersSet): IndexedFoldersSet {
        let localizationStrings: IndexedFoldersSet = new IndexedFoldersSet();

        for (let visualName in jsons) {
            
            let folders: any = jsons[visualName];

            for (let index in folders) {
                let capabilities: any = folders[index];

                let currentLocStrings: DisplayNameAndKeyPairs = new DisplayNameAndKeyPairs();
                let dataRolesStrings: DisplayNameAndKeyPairs = CapabilitiesParser.parseDataRoles(<any[]>capabilities.dataRoles);
                let objectsStrings: DisplayNameAndKeyPairs = CapabilitiesParser.parseObjects(<{[key: string]: string}>capabilities.objects);

                Object.assign(currentLocStrings, dataRolesStrings, objectsStrings);

                localizationStrings[visualName] = new IndexedObjects();
                localizationStrings[visualName]["en-US"] = currentLocStrings;
            }
        }

        return localizationStrings;
    }

    private static parseDataRoles(dataRoles: any[]): DisplayNameAndKeyPairs {
        let strings: DisplayNameAndKeyPairs = {};
        dataRoles.forEach((role) => {
            if (role.displayName && role.displayNameKey && !strings[role.displayNameKey]) {
                strings[role.displayNameKey] = role.displayName;
            }
        });

        return strings;
    }

    private static parseObject(obj: any, strings: DisplayNameAndKeyPairs) {        
        for (let prop in obj) {
            let property: any = obj[prop];

            if (property.displayName && property.displayNameKey && !strings[property.displayNameKey]) {
                strings[property.displayNameKey] = property.displayName;
            }

            if (typeof(property) === "object" ) {
                CapabilitiesParser.parseObject(property, strings);
            }
        }
    }

    private static parseObjects(objects: {[key: string]: {}}): DisplayNameAndKeyPairs {
        let strings: DisplayNameAndKeyPairs = {};
        for (let key in objects) {
            let object: any = objects[key];

            if (object.displayName && object.displayNameKey && !strings[object.displayNameKey]) {
                strings[object.displayNameKey] = object.displayName;
            }

            if (object.properties) {
                CapabilitiesParser.parseObject(object.properties, strings);
            }
        }

        return strings;
    }
}
