export class StringBuilder {
    private array: Array<string> = [];

    constructor(...initialValues: string[]) {
        this.array.push(...initialValues);
    }

    public get length(): number { return this.array.length; }

    public append(value: string): this {
        this.array.push(value);
        return this;
    }

    public clear(): this {
        this.array = [];
        return this;
    }

    public concat<T>(separator: string, ...values: T[]): this {
        this.array.push(values.join(separator));
        return this;
    }

    public substring(start: number, end?: number | undefined): string {
        return this.toString().substring(start, end);
    }

    public toString(): string {
        return this.array.join("");
    }
}
