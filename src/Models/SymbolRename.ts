import { CSharpAccessModifier } from "../CSharp/CSharpAccessModifier";
import { CSharpMemberModifiers } from "../CSharp/CSharpMemberModifiers";
import { CSharpSymbol } from "../CSharp/CSharpSymbol";
import { CSharpSymbolType } from "../CSharp/CSharpSymbolType";

export class SymbolRename {
    disabled = false;
    name!: string;
    details?: string;

    replacement!: string;

    accessModifier?: string;
    memberModifiers?: string;
    namePattern!: string;
    returnTypePattern?: string;
    types!: string;

    symbolAccessModifier: CSharpAccessModifier = CSharpAccessModifier.none;
    symbolMemberModifiers: CSharpMemberModifiers = CSharpMemberModifiers.none;
    symbolTypes: CSharpSymbolType[] = [];

    isMatched: boolean = false;
    newSymbolName?: string;

    constructor(init: Partial<SymbolRename>) {
        Object.assign(this, init);

        if (init.accessModifier) this.symbolAccessModifier = CSharpAccessModifier.fromString(init.accessModifier);
        if (init.memberModifiers) this.symbolMemberModifiers = CSharpMemberModifiers.fromDelimitedString(init.memberModifiers);
        if (init.types) this.symbolTypes = CSharpSymbolType.fromDelimitedString(init.types);
    }

    match(symbol: CSharpSymbol): boolean {
        if (!this.symbolTypes.includes(symbol.type)) return false;

        const nameMatch = symbol.name.match(this.namePattern);
        if (nameMatch === null || nameMatch.groups?.name === undefined) return false;
        const symbolName = nameMatch.groups.name;

        if (this.symbolAccessModifier !== CSharpAccessModifier.none && this.symbolAccessModifier !== symbol.accessModifier) return false;

        if (this.symbolMemberModifiers !== CSharpMemberModifiers.none && !CSharpMemberModifiers.flagExists(symbol.memberModifiers, this.symbolMemberModifiers)) return false;

        if (symbol.returnType && this.returnTypePattern) {
            const returnTypeMatch = symbol.returnType.match(this.returnTypePattern);
            if (returnTypeMatch === null) return false;
        }

        this.newSymbolName = SymbolRename.createNewSymbolName(symbolName, this.replacement); // this.replacement.replace(/\{name\}/g, nameMatch.groups.name);

        return this.isMatched = true; // assign (not compare) and return
    }

    private static createNewSymbolName(symbolName: string, replacement: string): string {
        const nameRegex = /\{name(:(?<indexes>[^:}]+))?(:(?<func>[^:}]+))?\}/g;

        let m;
        while (m = nameRegex.exec(replacement)) {
            const indexes = m.groups?.indexes ? m.groups.indexes.split("-").map(n => parseInt(n)) : undefined;
            const func = m.groups?.func?.toLocaleLowerCase();

            let name = indexes ? symbolName.substring(indexes[0], indexes[1] ?? symbolName.length) : symbolName;

            if (func === "lower") name = name.toLocaleLowerCase();
            else if (func === "upper") name = name.toLocaleUpperCase();

            replacement = replacement.replace(m[0], name);
            nameRegex.lastIndex = 0; // since 'replacement' was modified
        }

        return replacement;
    }
}
