import * as vscode from "vscode";

import { CSharpSymbol } from "../CSharp/CSharpSymbol";
import { SymbolMatcher, SymbolPropertyMatched } from "./SymbolMatcher";
import { CSharpFile } from "../CSharp/CSharpFile";
import { CSharpType } from "../CSharp/CSharpType";
import { ObjectResult } from "../Models/MessageResult";
import { AppliedCodingStyle } from "../Models/AppliedCodingStyle";
import { CSharpPatterns } from "../CSharp/CSharpPatterns";

export class CodingStyles {
    readonly convertNonPrivateFieldsToProperties = false; // ! TODO: to true once implemented
    readonly useLanguageKeywordsInsteadOfFrameworkTypes = true;

    static readonly convertNonPrivateFieldsToPropertiesName = "ConvertNonPrivateFieldsToProperties";
    static readonly useLanguageKeywordsInsteadOfFrameworkTypesName = "UseLanguageKeywordsInsteadOfFrameworkTypes";

    get anyEnabled(): boolean {
        return this.convertNonPrivateFieldsToProperties
            || this.useLanguageKeywordsInsteadOfFrameworkTypes;
    }

    constructor(init: Partial<CodingStyles>) {
        Object.assign(this, init);
    }

    async processFile(textEditor: vscode.TextEditor): Promise<ObjectResult<AppliedCodingStyle[]>> {
        const appliedCodingStyles: AppliedCodingStyle[] = [];

        do {
            const csharpFile = await CSharpFile.create(textEditor.document);
            if (!csharpFile.hasChildren) return ObjectResult.ok([], "No C# symbols found.");

            const processSymbolsResult = await this.processSymbols(textEditor, csharpFile.children);

            if (!processSymbolsResult.success) return ObjectResult.error(processSymbolsResult.message, appliedCodingStyles);

            if (processSymbolsResult.successWithObject) appliedCodingStyles.push(processSymbolsResult.object!);
            else break; // NOTE: if no coding style was applied, we're done, break the loop
        }
        while (true);

        return ObjectResult.ok(appliedCodingStyles, appliedCodingStyles.length === 0 ? "No coding styles applied." : undefined);
    }

    private async processSymbols(textEditor: vscode.TextEditor, symbols: CSharpSymbol[]): Promise<ObjectResult<AppliedCodingStyle | undefined>> {
        if (symbols.length === 0) return ObjectResult.ok(undefined, "No C# symbols to process.");

        // ! TODO: implement this
        /*if (this.convertNonPrivateFieldsToProperties) {
            const convertNonPrivateFieldsToPropertiesSymbolMatcher = new SymbolMatcher({
                types: "field",
                accessModifiers: "!:private protected,private"
                // ! TODO: account for readonly memberModifier (no set accessor)
            });

            const symbolMatches = convertNonPrivateFieldsToPropertiesSymbolMatcher.filter(symbols);
            for (const symbolMatch of symbolMatches) {
                console.log(`[${CodingStyles.convertNonPrivateFieldsToPropertiesName}]: ${symbolMatch.symbol.name}`);

                // ! TODO: apply coding style and return
            }
        }*/

        if (this.useLanguageKeywordsInsteadOfFrameworkTypes) {
            const useLanguageKeywordsInsteadOfFrameworkTypesSymbolMatcher = new SymbolMatcher({
                // TODO: need?: matchEitherNameOrReturnType: true,
                // TODO: need?: nameTypePattern: CSharpPatterns.frameworkTypes,
                returnTypePattern: CSharpPatterns.frameworkTypes,
                types: "!:namespace"
            });

            const symbolMatches = useLanguageKeywordsInsteadOfFrameworkTypesSymbolMatcher.filter(symbols);
            for await (const symbolMatch of symbolMatches) {

                let editAttempted = false;
                let editSucceeded = false;
                let appliedCodingStyleMessage = "";

                // TODO: need?
                /*if (SymbolPropertyMatched.hasFlag(symbolMatch.propertiesMatched, SymbolPropertyMatched.nameType)) {
                    if (!symbolMatch.symbol.nameRange) {
                        return ObjectResult.error(`Failed to apply coding style ${CodingStyles.useLanguageKeywordsInsteadOfFrameworkTypesName} to ${symbolMatch.symbol.memberName}: symbol name range is missing`);
                    }

                    const newNameType = CSharpType.replaceFrameworkTypesToLanguageKeywords(symbolMatch.symbol.name);

                    if (newNameType !== symbolMatch.symbol.name) {
                        editAttempted = true;
                        if (await textEditor.edit(editBuilder => {
                            editBuilder.replace(symbolMatch.symbol.nameRange!, newNameType!);
                        })) {
                            editSucceeded = true;
                            appliedCodingStyleMessage += `, name generic parameters: ${symbolMatch.symbol.name} -> ${newNameType}`;
                        }
                    }
                }*/

                if (SymbolPropertyMatched.hasFlag(symbolMatch.propertiesMatched, SymbolPropertyMatched.returnType)) {
                    if (!symbolMatch.symbol.returnTypeRange) {
                        return ObjectResult.error(`Failed to apply coding style ${CodingStyles.useLanguageKeywordsInsteadOfFrameworkTypesName} to ${symbolMatch.symbol.memberName}: symbol return type range is missing`);
                    }

                    const newReturnType = CSharpType.replaceFrameworkTypesToLanguageKeywords(symbolMatch.symbol.returnType!);

                    if (newReturnType !== symbolMatch.symbol.returnType) {
                        editAttempted = true;
                        if (await textEditor.edit(editBuilder => {
                            editBuilder.replace(symbolMatch.symbol.returnTypeRange!, newReturnType!);
                        })) {
                            editSucceeded = true;
                            appliedCodingStyleMessage += `, return type: ${symbolMatch.symbol.returnType} -> ${newReturnType}`;
                        }
                    }
                }

                if (!editAttempted) continue; // NOTE: no change needed (this actually shouldn't happen)

                return editSucceeded
                    ? ObjectResult.ok(new AppliedCodingStyle(CodingStyles.useLanguageKeywordsInsteadOfFrameworkTypesName, symbolMatch.symbol, appliedCodingStyleMessage.substring(2)))
                    : ObjectResult.error(`Failed to apply coding style ${CodingStyles.useLanguageKeywordsInsteadOfFrameworkTypesName} to ${symbolMatch.symbol.memberName}: text editor did not perform edit`);
            }
        }

        for await (const symbol of symbols) {
            if (symbol.hasChildren) {
                const codingStyleAppliedToChild = await this.processSymbols(textEditor, symbol.children);
                if (codingStyleAppliedToChild.successWithObject) return codingStyleAppliedToChild;
            }
        }

        return ObjectResult.ok();
    }
}

