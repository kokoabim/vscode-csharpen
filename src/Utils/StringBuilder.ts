export class StringBuilder {
    get length(): Number { return this._array.length; }

    private _array: Array<string> = [];

    constructor(...initialValues: string[]) {
        this._array.push(...initialValues);
    }

    append(value: string): this {
        this._array.push(value);
        return this;
    }

    clear(): this {
        this._array = [];
        return this;
    }

    concat<T>(separator: string, ...values: T[]): this {
        this._array.push(values.join(separator));
        return this;
    }

    substring(start: number, end?: number | undefined): string {
        return this.toString().substring(start, end);
    }

    toString(): string {
        return this._array.join("");
    }
}
