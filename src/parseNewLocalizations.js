const fs = require('fs-extra');
const path = require('path');

const newLocalizationsPath = path.join(__dirname, '..', 'loc');
const localizationPath = path.join(__dirname, '..', 'localizations');

function isValidLocaleDirectory(locale) {
    const localePath = path.join(newLocalizationsPath, locale);
    return fs.lstatSync(localePath).isDirectory() && 
           locale !== 'en' && 
           locale !== 'ResponseFiles';
}

function copyLocalizationFile(pathToNewLocalizations, visual, locale) {
    const newLocalizationFile = path.join(
        pathToNewLocalizations,
        locale,
        visual, 
        "stringResources",
        'en-US', // this is how data comes from OneLocBuild
        'resources.resjson'
    );
    
    const oldLocalizationFile = path.join(
        localizationPath,
        visual,
        "stringResources",
        locale,
        'resources.resjson'
    );

    console.log(`Trying to copy ${newLocalizationFile} to ${oldLocalizationFile}`);
    if(fs.existsSync(newLocalizationFile)) {
        console.log(`File exists, copying content...`);
        const newLocalizationContent = fs.readFileSync(newLocalizationFile, 'utf8');
        fs.ensureDirSync(path.dirname(oldLocalizationFile));
        fs.writeFileSync(oldLocalizationFile, newLocalizationContent, 'utf8');
        console.log(`Content copied successfully`);
    }
}

function processLocale(locale) {
    const pathToNewLocalizations = path.join(newLocalizationsPath, locale, "localizations");
    
    fs.readdirSync(pathToNewLocalizations).forEach(visual => {
        copyLocalizationFile(pathToNewLocalizations, visual, locale);
    });
}

console.log(`Reading new localizations from ${newLocalizationsPath}`);
const locales = fs.readdirSync(newLocalizationsPath)
    .filter(isValidLocaleDirectory)
console.log(`Found ${locales.length} locales`);

locales.forEach(processLocale);

