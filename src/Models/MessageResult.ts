import { LogLevel } from "vscode";

export class MessageResult {
    public readonly level: LogLevel = LogLevel.Off;
    public readonly message: string | undefined;
    public readonly success: boolean = false;

    constructor(success: boolean, message?: string, level?: LogLevel) {
        this.success = success;
        this.message = message;
        if (level) this.level = level;

        if (this.message && this.level === LogLevel.Off) this.level = success ? LogLevel.Info : LogLevel.Error;
    }

    public static error(message?: string): MessageResult {
        return new MessageResult(false, message, LogLevel.Error);
    }

    public static ok(message?: string): MessageResult {
        return new MessageResult(true, message);
    }

    public static warn(success: boolean, message?: string): MessageResult {
        return new MessageResult(success, message, LogLevel.Warning);
    }
}

export class ObjectResult<T> extends MessageResult {
    public readonly object: T | undefined;

    public get successWithObject(): boolean { return this.success && this.object !== undefined; }

    constructor(success: boolean, object?: T, message?: string, level?: LogLevel) {
        super(success, message, level);

        this.object = object;
    }

    public static error<T>(message?: string, object?: T): ObjectResult<T> {
        return new ObjectResult(false, object, message, LogLevel.Error);
    }

    public static ok<T>(object?: T, message?: string): ObjectResult<T> {
        return new ObjectResult(true, object, message);
    }
}