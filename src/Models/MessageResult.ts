import { LogLevel } from "vscode";

export class MessageResult {
    readonly level: LogLevel = LogLevel.Off;
    readonly message: string | undefined;
    readonly success: boolean = false;

    constructor(success: boolean, message?: string, level?: LogLevel) {
        this.success = success;
        this.message = message;
        if (level) this.level = level;

        if (this.message && this.level === LogLevel.Off) this.level = success ? LogLevel.Info : LogLevel.Error;
    }

    static error(message?: string): MessageResult {
        return new MessageResult(false, message, LogLevel.Error);
    }

    static ok(message?: string): MessageResult {
        return new MessageResult(true, message);
    }

    static warn(success: boolean, message?: string): MessageResult {
        return new MessageResult(success, message, LogLevel.Warning);
    }
}

export class ObjectResult<T> extends MessageResult {
    readonly object: T | undefined;

    get successWithObject(): boolean { return this.success && this.object !== undefined; }

    constructor(success: boolean, object?: T, message?: string, level?: LogLevel) {
        super(success, message, level);

        this.object = object;
    }

    static error<T>(message?: string, object?: T): ObjectResult<T> {
        return new ObjectResult(false, object, message, LogLevel.Error);
    }

    static ok<T>(object?: T, message?: string): ObjectResult<T> {
        return new ObjectResult(true, object, message);
    }
}