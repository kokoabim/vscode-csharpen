import * as vscode from "vscode";

import { CSharpFile } from "../CSharp/CSharpFile";
import { CSharpPatterns } from "../CSharp/CSharpPatterns";
import { CSharpSymbol } from "../CSharp/CSharpSymbol";
import { CSharpType } from "../CSharp/CSharpType";
import { AppliedCodingStyle } from "../Models/AppliedCodingStyle";
import { ObjectResult } from "../Models/MessageResult";
import { SymbolMatcher, SymbolPropertyMatched } from "./SymbolMatcher";

export class CodingStyles {
    public static readonly convertNonPrivateFieldsToPropertiesName = "ConvertNonPrivateFieldsToProperties";
    public static readonly useLanguageKeywordsInsteadOfFrameworkTypesName = "UseLanguageKeywordsInsteadOfFrameworkTypes";

    public convertNonPrivateFieldsToProperties = true;
    public useLanguageKeywordsInsteadOfFrameworkTypes = true;

    constructor(init: Partial<CodingStyles>) {
        Object.assign(this, init);
    }

    public get anyEnabled(): boolean {
        return this.convertNonPrivateFieldsToProperties
            || this.useLanguageKeywordsInsteadOfFrameworkTypes;
    }

    public async processFile(textEditor: vscode.TextEditor): Promise<ObjectResult<AppliedCodingStyle[]>> {
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

        if (this.convertNonPrivateFieldsToProperties) {
            const convertNonPrivateFieldsToPropertiesSymbolMatcher = new SymbolMatcher({
                types: "field",
                accessModifiers: "!:private protected,private",
                memberModifiers: "!:readonly",
            });

            const symbolMatches = convertNonPrivateFieldsToPropertiesSymbolMatcher.filter(symbols);
            for (const symbolMatch of symbolMatches) {
                console.log(`[${CodingStyles.convertNonPrivateFieldsToPropertiesName}]: ${symbolMatch.symbol.name}`);

                let editSucceeded = false;
                const accessorsWithAssignment = `${(symbolMatch.symbol.assignment ? "" : " ")}{ get; set; }${(symbolMatch.symbol.assignment ? " " + symbolMatch.symbol.assignment : "")}`;
                const replacePositionOrRange = symbolMatch.symbol.assignmentRange ?? new vscode.Range(symbolMatch.symbol.nameRange!.end, symbolMatch.symbol.range!.end);

                if (await textEditor.edit(editBuilder => {
                    editBuilder.replace(replacePositionOrRange, accessorsWithAssignment);
                })) {
                    editSucceeded = true;
                }

                return editSucceeded
                    ? ObjectResult.ok(new AppliedCodingStyle(CodingStyles.convertNonPrivateFieldsToPropertiesName, symbolMatch.symbol, "field to property"))
                    : ObjectResult.error(`Failed to apply coding style ${CodingStyles.convertNonPrivateFieldsToPropertiesName} to ${symbolMatch.symbol.memberName}: text editor did not perform edit`);
            }
        }

        if (this.useLanguageKeywordsInsteadOfFrameworkTypes) {
            const useLanguageKeywordsInsteadOfFrameworkTypesSymbolMatcher = new SymbolMatcher({
                returnTypePattern: CSharpPatterns.frameworkTypes,
                types: "!:namespace"
            });

            const symbolMatches = useLanguageKeywordsInsteadOfFrameworkTypesSymbolMatcher.filter(symbols);
            for await (const symbolMatch of symbolMatches) {
                let editAttempted = false;
                let editSucceeded = false;
                let appliedCodingStyleMessage = "";

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
                            appliedCodingStyleMessage += `return type: ${symbolMatch.symbol.returnType} -> ${newReturnType}`;
                        }
                    }
                }

                if (!editAttempted) continue; // NOTE: no change needed (this actually shouldn't happen)

                return editSucceeded
                    ? ObjectResult.ok(new AppliedCodingStyle(CodingStyles.useLanguageKeywordsInsteadOfFrameworkTypesName, symbolMatch.symbol, appliedCodingStyleMessage))
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
