import * as fs from "fs";
import * as path from "path";

const visualNames = require("../repositories.json");

class TranslationsValidator {
    private static resjsonFileName: string = "resources.resjson";
    private static exportFileName: string = "missed_translations.csv";

    private static export(rows: string[]): void {
        var fs = require('fs');
        var stream = fs.createWriteStream(TranslationsValidator.exportFileName);

        stream.once('open', function () {

            rows.forEach((row) => {
                stream.write(`${row}\n`);
            });

            stream.end();
        });
    }

    public static Run() {
        let jsonPaths: { [visual: string]: { [key: string]: string } } = {};

        console.log("All jsons paths building started.")

        for (let visualName in visualNames) {
            if (visualNames[visualName]) {
                let visualResourcesPath: string = path.join(__dirname, "..", visualName);
                let localeFolders: string[] = fs.readdirSync(visualResourcesPath);

                jsonPaths[visualName] = {};

                for (let i in localeFolders) {
                    let folder: string = localeFolders[i];
                    let pathToFile: string = path.join(visualResourcesPath, folder);

                    if (!fs.lstatSync(pathToFile).isDirectory()) {
                        continue;
                    }
                    jsonPaths[visualName][folder] = path.join(pathToFile, TranslationsValidator.resjsonFileName);
                }
            }
        }

        let brokenFilesCount: number = 0;
        let results: string[] = [];

        console.log("Validation process started");

        for (let visual in jsonPaths) {
            let visualLocales: { [key: string]: string } = jsonPaths[visual];

            let engStringsPath: string = visualLocales["en-US"];

            if (!engStringsPath) {
                ++brokenFilesCount;
                continue;
            }

            let engStrings: { [key: string]: string } = {};
            let fileString: string = fs.readFileSync(engStringsPath, "utf8");

            try {
                engStrings = JSON.parse(fileString);
            } catch (err) {
                ++brokenFilesCount;
                continue;
            }

            for (let locale in visualLocales) {
                if (locale === "en-US") {
                    continue;
                }
                let jsonPath: string = visualLocales[locale];
                let fileString: string = fs.readFileSync(jsonPath, "utf8");

                let obj: any = {};
                try {
                    obj = JSON.parse(fileString);
                } catch (err) {
                    ++brokenFilesCount;
                }

                let index: number = 1;
                for (let str in engStrings) {
                    index++;
                    if (!obj[str]) {
                        ++brokenFilesCount;
                    } else if (engStrings[str] === obj[str]) {
                        results.push(`${str},${engStrings[str]},${visual},${locale},${obj[str]}, https://github.com/Microsoft/powerbi-visuals-utils-localizationutils/blob/Loc/${visual}/${locale}/resources.resjson#L${index}`);
                    }
                }
            }
        }

        if (brokenFilesCount) {
            throw "Error has been occured: " + brokenFilesCount + (brokenFilesCount > 1 ? " files are" : " file is") + " not valid";
        }

        this.export(results);
    }
}

TranslationsValidator.Run();