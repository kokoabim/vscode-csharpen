import { CSharpSymbol } from "../CSharp/CSharpSymbol";
import { SymbolMatcher, SymbolMatcherPattern } from "./SymbolMatcher";

export class SymbolRename extends SymbolMatcherPattern {
    private static readonly nameRegex = /\{name(:(?<indexes>[^:}]+))?(:(?<func>[^:}]+))?\}/g;

    private readonly matcher: SymbolMatcher;

    public readonly details?: string;
    public readonly disabled = false;
    public readonly name!: string;
    public readonly replacement!: string;

    constructor(init: Partial<SymbolRename>) {
        super(init);

        Object.assign(this, init);
        this.matcher = new SymbolMatcher(this);
    }

    public process(symbol: CSharpSymbol): string | undefined {
        if (this.disabled) return;

        const match = this.matcher.process(symbol);
        if (!match.isMatched) return;

        const newSymbolName = this.createNewSymbolName(match.data.name);
        return symbol.name !== newSymbolName ? newSymbolName : undefined;
    }

    private createNewSymbolName(symbolNameMatch: string): string {
        let newSymbolName = `${this.replacement}`;

        let m;
        SymbolRename.nameRegex.lastIndex = 0;
        while (m = SymbolRename.nameRegex.exec(newSymbolName)) {
            const indexes = m.groups?.indexes ? m.groups.indexes.split("-").map(n => parseInt(n)) : undefined;
            const func = m.groups?.func?.toLocaleLowerCase();

            let name = indexes ? symbolNameMatch.substring(indexes[0], indexes[1] ?? symbolNameMatch.length) : symbolNameMatch;

            // NOTE: add new functions here
            if (func === "lower") name = name.toLocaleLowerCase();
            else if (func === "upper") name = name.toLocaleUpperCase();

            newSymbolName = newSymbolName.replace(m[0], name);
            SymbolRename.nameRegex.lastIndex = 0; // since 'replacement' was modified
        }

        return newSymbolName;
    }
}
