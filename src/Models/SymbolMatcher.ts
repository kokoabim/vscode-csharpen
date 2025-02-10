import { CSharpAccessModifier } from "../CSharp/CSharpAccessModifier";
import { CSharpMemberModifiers } from "../CSharp/CSharpMemberModifiers";
import { CSharpSymbol } from "../CSharp/CSharpSymbol";
import { CSharpSymbolType } from "../CSharp/CSharpSymbolType";

export class SymbolMatcherPattern {
    accessModifiers?: string;
    accessModifierComparison = true;
    memberModifiers?: string;
    memberModifiersComparison = true;
    namePattern!: string;
    returnTypePattern?: string;
    types!: string;
    typesComparison = true;

    constructor(init: Partial<SymbolMatcherPattern>) {
        Object.assign(this, init);
    }
}

export class SymbolMatcher {
    accessModifiers: CSharpAccessModifier[] = [];
    memberModifiers: CSharpMemberModifiers = CSharpMemberModifiers.none;
    types: CSharpSymbolType[] = [];

    constructor(private pattern: SymbolMatcherPattern) {
        if (pattern.accessModifiers) {
            if (pattern.accessModifiers.startsWith("!:")) {
                pattern.accessModifierComparison = false;
                pattern.accessModifiers = pattern.accessModifiers.substring(2);
            }

            this.accessModifiers = CSharpAccessModifier.fromDelimitedString(pattern.accessModifiers);
        }

        if (pattern.memberModifiers) {
            if (pattern.memberModifiers.startsWith("!:")) {
                pattern.memberModifiersComparison = false;
                pattern.memberModifiers = pattern.memberModifiers.substring(2);
            }

            this.memberModifiers = CSharpMemberModifiers.fromDelimitedString(pattern.memberModifiers);
        }

        if (pattern.types) {
            if (pattern.types.startsWith("!:")) {
                pattern.typesComparison = false;
                pattern.types = pattern.types.substring(2);
            }

            this.types = CSharpSymbolType.fromDelimitedString(pattern.types);
        }
    }

    process(symbol: CSharpSymbol): [success: boolean, symbolNameMatch: string | undefined] {
        if (this.types.length > 0 && this.types.includes(symbol.type) !== this.pattern.typesComparison) return [false, undefined];

        if (this.accessModifiers.length > 0 && this.accessModifiers.includes(symbol.accessModifier) !== this.pattern.accessModifierComparison) return [false, undefined];

        if (this.memberModifiers !== CSharpMemberModifiers.none && CSharpMemberModifiers.flagExists(symbol.memberModifiers, this.memberModifiers) !== this.pattern.memberModifiersComparison) return [false, undefined];

        if (this.pattern.returnTypePattern && symbol.returnType && symbol.returnType.match(this.pattern.returnTypePattern) === null) return [false, undefined];

        const nameMatch = symbol.name.match(this.pattern.namePattern);

        return (nameMatch === null || nameMatch.groups?.name === undefined)
            ? [false, undefined]
            : [true, nameMatch.groups.name];
    }
}
