import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet } from './models';

export class CapabilitiesParser {
    public static parseCapabilities(jsons: IndexedFoldersSet): IndexedFoldersSet {
        const localizationStrings: IndexedFoldersSet = new IndexedFoldersSet();

        for (const visualName in jsons) {
            
            const folders: any = jsons[visualName];

            for (const index in folders) {
                const capabilities: any = folders[index];

                const currentLocStrings: DisplayNameAndKeyPairs = new DisplayNameAndKeyPairs();
                const dataRolesStrings: DisplayNameAndKeyPairs = CapabilitiesParser.parseDataRoles(<any[]>capabilities.dataRoles);
                const objectsStrings: DisplayNameAndKeyPairs = CapabilitiesParser.parseObjects(<{[key: string]: string}>capabilities.objects);

                Object.assign(currentLocStrings, dataRolesStrings, objectsStrings);

                localizationStrings[visualName] = new IndexedObjects();
                localizationStrings[visualName]["en-US"] = currentLocStrings;
            }
        }

        return localizationStrings;
    }

    private static parseDataRoles(dataRoles: any[]): DisplayNameAndKeyPairs {
        const strings: DisplayNameAndKeyPairs = {};
        dataRoles.forEach((role) => {
            if (role.displayName && role.displayNameKey && !strings[role.displayNameKey]) {
                strings[role.displayNameKey] = role.displayName;
            }
        });

        return strings;
    }

    private static parseObject(obj: any, strings: DisplayNameAndKeyPairs) {        
        for (const prop in obj) {
            const property: any = obj[prop];

            if (property.displayName && property.displayNameKey && !strings[property.displayNameKey]) {
                strings[property.displayNameKey] = property.displayName;
            }

            if (typeof(property) === "object" ) {
                CapabilitiesParser.parseObject(property, strings);
            }
        }
    }

    private static parseObjects(objects: {[key: string]: {}}): DisplayNameAndKeyPairs {
        const strings: DisplayNameAndKeyPairs = {};
        for (const key in objects) {
            const object: any = objects[key];

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
