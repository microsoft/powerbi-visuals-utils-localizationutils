import * as fs from "fs";
import * as path from "path";

const visualsToParse = require("../repositories.json");

class JsonValidator {
    private static resjsonFileName: string = "resources.resjson";

    public static Run() {
        const jsonPaths: string[] = [];

        console.log("All jsons paths building started.")

        for (const visualName in visualsToParse) {            
            if (visualsToParse[visualName]) { 
                console.log(visualName + ": getting all directories.");

                console.log("dirname: " + __dirname + ";.." + "; visualName: " + visualName);

                const visualResourcesPath: string = path.join(__dirname, "..", visualName);

                const localeFolders: string[] = fs.readdirSync(visualResourcesPath)
                                          .map(name => path.join(visualResourcesPath, name))
                                          .filter(directory => fs.lstatSync(directory).isDirectory());

                console.log(visualName + ": all directories recieved.");

                for (const i in localeFolders) {
                    const localeFolder: string = localeFolders[i];
                    
                    jsonPaths.push(path.join(localeFolders[i], JsonValidator.resjsonFileName));
                    console.log(visualName + "/" + localeFolder + ": path has been built.");
                }                
            }
        }

        let brokenFilesCount: number = 0;

        console.log("Validation process started");
        for (const i in jsonPaths) {
            const jsonPath: string = jsonPaths[i]
            const fileString: string = fs.readFileSync(jsonPath, "utf8");

            try {
                JSON.parse(fileString);
                console.log("\x1b[32m%s\x1b[0m", jsonPath + " is valid");
            } catch (err){
                ++brokenFilesCount;
                console.log("\x1b[31m%s\x1b[0m", jsonPath + " error occured: " + (<any>err).message);
            }    
        }

        if (brokenFilesCount) {
            throw "Error has been occured: " + brokenFilesCount + (brokenFilesCount > 1 ? " files are" : " file is" ) + " not valid";
        }
    }
}

JsonValidator.Run();