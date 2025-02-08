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

    isMatched: boolean = false;
    newSymbolName?: string;

    constructor(init: Partial<SymbolRename>) {
        Object.assign(this, init);
    }

    match(symbol: CSharpSymbol): boolean {
        if (!CSharpSymbolType.fromDelimitedString(this.types).includes(symbol.type)) return false;

        const nameMatch = symbol.name.match(this.namePattern);
        if (nameMatch === null || nameMatch.groups?.name === undefined) return false;

        if (this.accessModifier && this.accessModifier !== CSharpAccessModifier.toString(symbol.accessModifier)) return false;

        if (this.memberModifiers) {
            const memberModifiers = CSharpMemberModifiers.fromDelimitedString(this.memberModifiers);
            if (!CSharpMemberModifiers.flagExists(symbol.memberModifiers, memberModifiers)) return false;
        }

        if (symbol.returnType && this.returnTypePattern) {
            const returnTypeMatch = symbol.returnType.match(this.returnTypePattern);
            if (returnTypeMatch === null) return false;
        }

        this.newSymbolName = this.replacement.replace(/\{name\}/g, nameMatch.groups.name);

        return this.isMatched = true; // assign (not compare) and return
    }
}
