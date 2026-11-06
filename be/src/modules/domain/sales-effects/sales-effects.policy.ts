import { SalesEffectsError, SalesEffectsErrorCode } from "./errors/sales-effects.error"
import { recordIdSchema } from "./sales-effects.schema"

/** What a schema answers when it reads a value: the value, or that it is not the shape. */
interface Readable<T> {
    /** Reads the value without throwing. */
    readonly safeParse: (value: unknown) => { readonly success: true; readonly data: T } | { readonly success: false }
}

/** Whether a text is an id of a record (a uuid); anything else names no record. */
export const isRecordId = (id: string): boolean => recordIdSchema.safeParse(id).success

/** What a payload reads to under the schema of its effect, or the refusal that it is not what the effect asks for. */
export const payloadOf = <T>(schema: Readable<T>, payload: unknown): T => {
    const parsed = schema.safeParse(payload)
    if (!parsed.success) throw new SalesEffectsError({ code: SalesEffectsErrorCode.InvalidPayload })
    return parsed.data
}
