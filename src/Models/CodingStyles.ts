export class CodingStyles {
    convertNonPrivateFieldsToProperties = true;
    useLanguageKeywordsInsteadOfFrameworkTypes = true;

    get anyEnabled(): boolean {
        return this.convertNonPrivateFieldsToProperties
            || this.useLanguageKeywordsInsteadOfFrameworkTypes;
    }

    constructor(init: Partial<CodingStyles>) {
        Object.assign(this, init);
    }

    // ! TODO: implement this in next release
}