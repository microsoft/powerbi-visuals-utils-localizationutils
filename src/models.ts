export enum SourceType {
    Capabilities,
    LocalizationStrings,
    UtilsRepo
}

export enum UpdateType {
    CapabilitiesToCv,
    CvToUtils,
    UtilsToCv
}

export class UpdateBranch {
    public static FromCapabilities: string = "locUpdateCapabilities";
    public static FromUtils: string = "locUpdate";
}

export class IndexedObjects {
    [Index: string]: {};
}

export class IndexedFoldersSet {
    [VisualName: string]:  IndexedObjects;
}

export class DisplayNameAndKeyPairs {
    [DisplayNameKey: string]: string;
}

export class IndexedLocalizationStrings {
    [VisualName: string]: DisplayNameAndKeyPairs;
}
