import type { Writable } from "node:stream"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogErr, InjectLogOut } from "./logging.decorators"
import type { LogFields, Logger } from "./logging.port"
import { redactFields } from "./redact.policy"

/** The code and text parameters a capability error carries (the shape of `DomainError`, read without importing it); nothing for any other error. */
const capabilityFacts = (cause: Error): LogFields => {
    const code: unknown = "code" in cause ? cause.code : undefined
    const params: unknown = "params" in cause ? cause.params : undefined
    return typeof code === "string" && typeof params === "object" && params !== null
        ? { errorCode: code, errorParams: params }
        : {}
}

type Level = "info" | "warn" | "error"

/** The default adapter: one JSON object per line, stamped by the Clock; info goes to `out`, warn and error to `err`. */
export class JsonLoggerService implements Logger {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogOut() private readonly out: Writable,
        @InjectLogErr() private readonly err: Writable,
    ) {}

    /** Writes an info line. */
    info(event: string, fields?: LogFields): void {
        this.write("info", this.out, event, fields)
    }

    /** Writes a warn line. */
    warn(event: string, fields?: LogFields): void {
        this.write("warn", this.err, event, fields)
    }

    /**
     * Writes an error line with the cause serialized by name and message. A capability error also tells its code and its text parameters
     * (a refused query names its problem, location and entity; a refused statement its SQLSTATE), which never carry a value.
     */
    error(event: string, cause: unknown, fields?: LogFields): void {
        const detail =
            cause instanceof Error
                ? {
                      errorName: cause.name,
                      errorMessage: cause.message,
                      ...capabilityFacts(cause),
                  }
                : { errorMessage: String(cause) }
        this.write("error", this.err, event, { ...detail, ...fields })
    }

    /** Every line is scrubbed of credentials (tokens, keys, passwords) before it is written: logs never carry a secret. */
    private write(level: Level, sink: Writable, event: string, fields?: LogFields): void {
        const safe = fields === undefined ? {} : redactFields(fields)
        sink.write(`${JSON.stringify({ level, event, time: this.clock.now().toISOString(), ...safe })}\n`)
    }
}

/** Builds the JSON logger stamping lines with `clock`, info on `out` (stdout by default) and the rest on stderr; main.ts uses it before the DI container exists. */
export const createJsonLogger = (clock: Clock, out: Writable = process.stdout): Logger =>
    new JsonLoggerService(clock, out, process.stderr)
