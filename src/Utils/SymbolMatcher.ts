import { CSharpAccessModifier } from "../CSharp/CSharpAccessModifier";
import { CSharpMemberModifiers } from "../CSharp/CSharpMemberModifiers";
import { CSharpSymbol } from "../CSharp/CSharpSymbol";
import { CSharpSymbolType } from "../CSharp/CSharpSymbolType";

export class SymbolMatcherPattern {
    accessModifiers?: string;
    accessModifierComparison? = true;

    memberModifiers?: string;
    memberModifiersComparison? = true;

    namePattern?: string;

    // TODO: need?: matchEitherNameOrReturnType?: boolean;
    // TODO: need?: nameTypePattern?: string;
    returnTypePattern?: string;

    types?: string;
    typesComparison? = true;

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

    filter(symbols: CSharpSymbol[]): SymbolMatch[] {
        return symbols.map(symbol => this.process(symbol)).filter(sm => sm.isMatched);
    }

    process(symbol: CSharpSymbol): SymbolMatch {
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
            if (!matchedReturnTypePattern /* && !this.pattern.matchEitherNameOrReturnType */) return match;

            if (matchedReturnTypePattern) match.propertiesMatched |= SymbolPropertyMatched.returnType;
        }

        // TODO: need?
        /*if (this.pattern.nameTypePattern) {
            const matchedNameTypePattern = (symbol.nameTypeHasGenerics ? symbol.name ?? "" : "").match(this.pattern.nameTypePattern) !== null;
            if (!matchedNameTypePattern) return match;
            match.propertiesMatched |= SymbolPropertyMatched.nameType;
        }*/

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

export class SymbolMatch {
    data: { [key: string]: any } = {};
    isMatched = false;
    propertiesMatched: SymbolPropertyMatched = SymbolPropertyMatched.none;

    constructor(public symbol: CSharpSymbol) { }
}

export enum SymbolPropertyMatched {
    none = 0,
    symbolType = 1 << 0,
    name = 1 << 1,
    returnType = 1 << 2,
    accessModifiers = 1 << 3,
    memberModifiers = 1 << 4,
    // TODO: need?: nameType = 1 << 5,
}

export namespace SymbolPropertyMatched {
    export function hasFlag(value: SymbolPropertyMatched, flag: SymbolPropertyMatched): boolean {
        return (value & flag) === flag;
    }
}