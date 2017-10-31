import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
const decompress = require('decompress');
const decompressTargz = require('decompress-targz');

import { DisplayNameAndKeyPairs, IndexedObjects, IndexedFoldersSet } from "./models";

export class LoaderUtils {
    public static async ExtractTargz(targz: any, srcFilePath: string, distFolderPath: string): Promise<void> {   
        fs.writeFileSync(srcFilePath, targz);
        return  decompress(srcFilePath, "dist", {
            plugins: [
                decompressTargz()
            ]
        });  
    }

    public static GetIndexedObjects(pathToLocales: string, skipEnUs?: boolean): IndexedObjects {
        let indexedObject: IndexedObjects = new IndexedObjects();

        let locales: string[] = fs.readdirSync(pathToLocales);

        if (skipEnUs) {
            locales = locales.filter(x => x !== "en-US");
        }

        locales.filter(x => x !== "qps-ploc" && fs.lstatSync(path.join(pathToLocales, x)).isDirectory()).forEach((locale) => {
            let localePath: string = path.join(pathToLocales, locale);

            let fileString: string = fs.readFileSync(path.join(localePath, "resources.resjson"), "utf8");

            indexedObject[locale] = JSON.parse(fileString.replace('\uFEFF', ''));
        });

        return indexedObject;
    }
}