
export enum SourceType {
    Capabilities,
    LocalizationStrings,
    UtilsRepo
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
