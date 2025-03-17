export class StringSpan {
    constructor(public start: number, public end: number, public value: string) { }

    public get length(): number { return this.value.length; }
}
