import * as fs from "fs";
import * as path from "path";

const visualNames = require("../repositories.json");

class JsonValidator {
    private static resjsonFileName: string = "resources.resjson";

    public static Run() {
        let jsonPaths: string[] = [];

        console.log("All jsons paths building started.")

        for (let visualName in visualNames) {            
            if (visualNames[visualName]) { 
                console.log(visualName + ": getting all directories.");

                console.log("dirname: " + __dirname + ";.." + "; visualName: " + visualName);

                let visualResourcesPath: string = path.join(__dirname, "..", visualName);

                let localeFolders: string[] = fs.readdirSync(visualResourcesPath)
                                          .map(name => path.join(visualResourcesPath, name))
                                          .filter(directory => fs.lstatSync(directory).isDirectory());

                console.log(visualName + ": all directories recieved.");

                for (let i in localeFolders) {
                    let localeFolder: string = localeFolders[i];
                    
                    jsonPaths.push(path.join(localeFolders[i], JsonValidator.resjsonFileName));
                    console.log(visualName + "/" + localeFolder + ": path is built.");
                }                
            }
        }

        for (let i in jsonPaths) {
            let jsonPath: string = jsonPaths[i]
            fs.readFile(jsonPath, "utf8", function(err, data){
                if (err) {
                    console.log(jsonPath + " exception was occured while reading file: " + err);
                    throw err;
                }

                console.log(jsonPath + " parsing started");
                let obj: {} = JSON.parse(data);
                console.log(jsonPath + " has been succsesfully parsed");
            });
        }
    }
}

JsonValidator.Run();