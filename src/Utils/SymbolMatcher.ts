import { CSharpAccessModifier } from "../CSharp/CSharpAccessModifier";
import { CSharpMemberModifiers } from "../CSharp/CSharpMemberModifiers";
import { CSharpSymbol } from "../CSharp/CSharpSymbol";
import { CSharpSymbolType } from "../CSharp/CSharpSymbolType";

export enum SymbolPropertyMatched {
    none = 0,
    symbolType = 1 << 0,
    name = 1 << 1,
    returnType = 1 << 2,
    accessModifiers = 1 << 3,
    memberModifiers = 1 << 4,
}

export class SymbolMatch {
    public data: { [key: string]: any } = {};
    public isMatched = false;
    public propertiesMatched: SymbolPropertyMatched = SymbolPropertyMatched.none;

    constructor(public symbol: CSharpSymbol) { }
}

export class SymbolMatcher {
    public accessModifiers: CSharpAccessModifier[] = [];
    public memberModifiers: CSharpMemberModifiers = CSharpMemberModifiers.none;
    public types: CSharpSymbolType[] = [];

    constructor(private pattern: SymbolMatcherPattern) {
        if (pattern.accessModifiers) {
            if (pattern.accessModifiers.startsWith("!:")) {
                pattern.accessModifierComparison = false;
                pattern.accessModifiers = pattern.accessModifiers.substring(2);
            }
            else {
                pattern.accessModifierComparison = true;
            }

            this.accessModifiers = CSharpAccessModifier.fromDelimitedString(pattern.accessModifiers);
        }

        if (pattern.memberModifiers) {
            if (pattern.memberModifiers.startsWith("!:")) {
                pattern.memberModifiersComparison = false;
                pattern.memberModifiers = pattern.memberModifiers.substring(2);
            }
            else {
                pattern.memberModifiersComparison = true;
            }

            this.memberModifiers = CSharpMemberModifiers.fromDelimitedString(pattern.memberModifiers);
        }

        if (pattern.types) {
            if (pattern.types.startsWith("!:")) {
                pattern.typesComparison = false;
                pattern.types = pattern.types.substring(2);
            }
            else {
                pattern.typesComparison = true;
            }

            this.types = CSharpSymbolType.fromDelimitedString(pattern.types);
        }
    }

    public filter(symbols: CSharpSymbol[]): SymbolMatch[] {
        return symbols.map(symbol => this.process(symbol)).filter(sm => sm.isMatched);
    }

    public process(symbol: CSharpSymbol): SymbolMatch {
        const match = new SymbolMatch(symbol);

        if (this.types.length > 0) {
            if (this.types.includes(symbol.type) !== this.pattern.typesComparison) return match;
            match.propertiesMatched |= SymbolPropertyMatched.symbolType;
        }

        if (this.accessModifiers.length > 0) {
            if (this.accessModifiers.includes(symbol.accessModifier) !== this.pattern.accessModifierComparison) return match;
            match.propertiesMatched |= SymbolPropertyMatched.accessModifiers;
        }

        if (this.memberModifiers !== CSharpMemberModifiers.none) {
            if (CSharpMemberModifiers.hasFlag(symbol.memberModifiers, this.memberModifiers) !== this.pattern.memberModifiersComparison) return match;
            match.propertiesMatched |= SymbolPropertyMatched.memberModifiers;
        }

        if (this.pattern.returnTypePattern) {
            const matchedReturnTypePattern = (symbol.returnType ?? "").match(this.pattern.returnTypePattern) !== null;
            if (!matchedReturnTypePattern) return match;
            match.propertiesMatched |= SymbolPropertyMatched.returnType;
        }

        if (this.pattern.namePattern) {
            const symbolName = symbol.name.match(this.pattern.namePattern)?.groups?.name;
            if (!symbolName) return match;

            match.propertiesMatched |= SymbolPropertyMatched.name;
            match.data["name"] = symbolName;
        }

        match.isMatched = true;
        return match;
    }
}

export class SymbolMatcherPattern {
    public accessModifierComparison? = true;
    public accessModifiers?: string;
    public memberModifiers?: string;
    public memberModifiersComparison? = true;
    public namePattern?: string;
    public returnTypePattern?: string;
    public types?: string;
    public typesComparison? = true;

    constructor(init: Partial<SymbolMatcherPattern>) {
        Object.assign(this, init);
    }
}

export namespace SymbolPropertyMatched {
    export function hasFlag(value: SymbolPropertyMatched, flag: SymbolPropertyMatched): boolean {
        return (value & flag) === flag;
    }
}
