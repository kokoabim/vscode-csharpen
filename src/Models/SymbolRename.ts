import { CSharpSymbol } from "../CSharp/CSharpSymbol";
import { SymbolMatcher, SymbolMatcherPattern } from "./SymbolMatcher";

export class SymbolRename extends SymbolMatcherPattern {
    readonly disabled = false;
    readonly name!: string;
    readonly details?: string;
    readonly replacement!: string;

    private readonly matcher: SymbolMatcher;
    private static readonly nameRegex = /\{name(:(?<indexes>[^:}]+))?(:(?<func>[^:}]+))?\}/g;

    constructor(init: Partial<SymbolRename>) {
        super(init);

        Object.assign(this, init);
        this.matcher = new SymbolMatcher(this);
    }

    process(symbol: CSharpSymbol): string | undefined {
        if (this.disabled) return;

        const [success, symbolNameMatch] = this.matcher.process(symbol);
        if (!success) return;

        const newSymbolName = this.createNewSymbolName(symbolNameMatch!);
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

            // TODO: add new functions here
            if (func === "lower") name = name.toLocaleLowerCase();
            else if (func === "upper") name = name.toLocaleUpperCase();

            newSymbolName = newSymbolName.replace(m[0], name);
            SymbolRename.nameRegex.lastIndex = 0; // since 'replacement' was modified
        }

        return newSymbolName;
    }
}
