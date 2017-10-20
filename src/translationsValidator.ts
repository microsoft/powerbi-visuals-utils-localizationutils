import * as fs from "fs";
import * as path from "path";

const visualNames = require("../repositories.json");

class TranslationsValidator {
    private static resjsonFileName: string = "resources.resjson";

    public static Run() {
        let jsonPaths: { [visual: string]: { [key: string]: string } } = {};

        console.log("All jsons paths building started.")

        for (let visualName in visualNames) {            
            if (visualNames[visualName]) { 
                console.log(visualName + ": getting all directories.");

                console.log("dirname: " + __dirname + ";.." + "; visualName: " + visualName);

                let visualResourcesPath: string = path.join(__dirname, "..", visualName);

                let localeFolders: string[] = fs.readdirSync(visualResourcesPath);
                console.log(visualName + ": all directories recieved.");               

                jsonPaths[visualName] = {};

                for (let i in localeFolders) { 
                    let folder: string = localeFolders[i];
                    let pathToFile: string = path.join(visualResourcesPath, folder);
                    
                    if (!fs.lstatSync(pathToFile).isDirectory()) {
                        continue;
                    }
                    
                    jsonPaths[visualName][folder] = path.join(pathToFile, TranslationsValidator.resjsonFileName);
                    console.log(visualName + "/" + folder + ": path has been built.");                    
                }                             
            }
        }

        let brokenFilesCount: number = 0;

        console.log("Validation process started");
        for (let visual in jsonPaths) {
            let visualLocales: {[key: string]: string } = jsonPaths[visual];
            
            let engStringsPath: string = visualLocales["en-US"];

            if (!engStringsPath) {
                console.log("\x1b[31m%s\x1b[0m", visual + " got no en-US locale");
                ++ brokenFilesCount;
                continue;
            }

            let engStrings: {[key: string]: string } = {};
            let fileString: string = fs.readFileSync(engStringsPath, "utf8");

            try {
                engStrings =  JSON.parse(fileString);
                console.log("\x1b[32m%s\x1b[0m", engStringsPath + " is valid");
            } catch (err) {
                ++ brokenFilesCount;
                console.log("\x1b[31m%s\x1b[0m", engStringsPath + " error occured: " + err.message);
                continue;
            }           

            for (let j in visualLocales) {
                if (j === "en-US") {
                    continue;
                }

                let jsonPath: string = visualLocales[j];                
                let fileString: string = fs.readFileSync(jsonPath, "utf8");
                
                let obj: any = {};
                try {
                    obj = JSON.parse(fileString);
                    console.log("\x1b[32m%s\x1b[0m", jsonPath + " is valid");
                } catch (err){
                    ++ brokenFilesCount;
                    console.log("\x1b[31m%s\x1b[0m", jsonPath + " error occured: " + err.message);
                }  

                for (let str in engStrings) {
                    if(!obj[str]) {
                        ++ brokenFilesCount;
                        console.log("\x1b[31m%s\x1b[0m", jsonPath + " key " + str + " is missing");                        
                    } 
                }                           
            }             
        }

        if (brokenFilesCount) {
            throw "Error has been occured: " + brokenFilesCount + (brokenFilesCount > 1 ? " files are" : " file is" ) + " not valid";
        }
    }
}

TranslationsValidator.Run();