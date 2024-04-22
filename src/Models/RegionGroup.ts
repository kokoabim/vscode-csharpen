import { CSharpSymbol } from "../CSharp/CSharpSymbol";

export class RegionGroup {
    constructor(public name: string, public symbols: CSharpSymbol[] = []) {
    }
}
