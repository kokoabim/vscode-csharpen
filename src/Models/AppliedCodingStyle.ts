import { CSharpAccessModifier } from "../CSharp/CSharpAccessModifier";
import { CSharpSymbol } from "../CSharp/CSharpSymbol";
import { CSharpSymbolType } from "../CSharp/CSharpSymbolType";


export class AppliedCodingStyle {
    constructor(
        public readonly name: string,
        public readonly symbol: CSharpSymbol,
        public readonly message?: string
    ) { }

    text(): string {
        return `[CodeStyle: ${this.name}] ${this.symbol.memberName} (${CSharpAccessModifier.toString(this.symbol.accessModifier)} ${CSharpSymbolType.toString(this.symbol.type)}): ${this.message}`;
    }
}
