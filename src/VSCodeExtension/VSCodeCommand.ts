export class VSCodeCommand {
    constructor(
        public name: string,
        public command: (...args: any[]) => any
    ) { }
}
