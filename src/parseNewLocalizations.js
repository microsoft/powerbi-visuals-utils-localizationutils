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
        visual, 
        "stringResources",
        'en-US',
        'resources.resjson'
    );
    
    const oldLocalizationFile = path.join(
        localizationPath,
        visual,
        "stringResources",
        locale,
        'resources.resjson'
    );

    const newLocalizationContent = fs.readFileSync(newLocalizationFile, 'utf8');
    fs.ensureDirSync(path.dirname(oldLocalizationFile));
    fs.writeFileSync(oldLocalizationFile, newLocalizationContent, 'utf8');
    console.log(`Content from ${newLocalizationContent} copied to ${oldLocalizationFile}`);
}

function processLocale(locale) {
    const pathToNewLocalizations = path.join(newLocalizationsPath, locale, "localizations");
    
    fs.readdirSync(pathToNewLocalizations).forEach(visual => {
        copyLocalizationFile(pathToNewLocalizations, visual, locale);
    });

    fs.rmSync(path.join(newLocalizationsPath, locale), { recursive: true, force: true });
}

fs.readdirSync(newLocalizationsPath)
    .filter(isValidLocaleDirectory)
    .forEach(processLocale);

fs.rmSync(newLocalizationsPath, { recursive: true, force: true });
