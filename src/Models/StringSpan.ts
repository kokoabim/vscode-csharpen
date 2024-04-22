export class StringSpan {
    constructor(public start: number, public end: number, public value: string) { }

    get length(): number { return this.value.length; }
}
