import type { z } from "zod"
import { isRecord } from "../schema/is-record"
import type { PropsSchema } from "../schema/schema.types"
import type { ActionInput, InputProblem } from "./block.types"

/** A raw value parsed against a props schema: the typed value, or why it was refused. */
export type ParsedInput<T> =
    { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problems: ReadonlyArray<InputProblem> }

/** A zod issue path as a dotted path; `.` for the whole value. */
const pathOf = (path: ReadonlyArray<PropertyKey>): string => (path.length === 0 ? "." : path.map(String).join("."))

/**
 * Parses a raw value as the variables of a read or the input of an action. Unlike a plain zod parse, a key the schema does not
 * declare is refused (`INPUT_UNKNOWN_KEY`) instead of silently dropped, so a door never runs on a value it did not read.
 */
export const parseStrict = <S extends PropsSchema>(schema: S, raw: unknown): ParsedInput<z.infer<S>> => {
    const declared = Object.keys(schema.shape)
    const extra = isRecord(raw) ? Object.keys(raw).filter((key) => !declared.includes(key)) : []
    const parsed = schema.safeParse(raw)
    if (parsed.success && extra.length === 0) return { ok: true, value: parsed.data }
    return {
        ok: false,
        problems: [
            ...extra.map((key): InputProblem => ({ code: "INPUT_UNKNOWN_KEY", at: key })),
            ...(parsed.success
                ? []
                : parsed.error.issues.map((issue): InputProblem => ({
                      code: "INPUT_INVALID",
                      at: pathOf(issue.path),
                  }))),
        ],
    }
}

/** The flat payload the door receives for an action input: the `values` with `id` (and `command` when given) merged in. */
export const actionPayloadOf = (input: ActionInput): Readonly<Record<string, string | number | boolean | null>> => ({
    ...input.values,
    id: input.id,
    ...(input.command === undefined ? {} : { command: input.command }),
})
