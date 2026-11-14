import { z } from "zod"
import { textOf } from "../slots/paths"

/** The longest message key and placeholder name a read may carry, and the longest text value of a placeholder. */
const KEY_MAX = 200
const NAME_MAX = 64
const VALUE_MAX = 200
const VALUES_MAX = 20

/** What a read yields where its text is the module's words: a message key of the spec's namespace and what its placeholders take. */
export interface Message {
    /** The key of the message in the namespace of the module whose spec draws it. */
    readonly key: string
    /** What each `{name}` placeholder of the message is replaced by. */
    readonly values?: Readonly<Record<string, string | number>> | undefined
}

/** The shape of a message in a read's data: a key and its placeholder values, nothing else. */
export const messageView: z.ZodType<Message> = z
    .object({
        key: z.string().min(1).max(KEY_MAX),
        values: z
            .record(z.string().max(NAME_MAX), z.union([z.string().max(VALUE_MAX), z.number()]))
            .refine((values) => Object.keys(values).length <= VALUES_MAX)
            .optional(),
    })
    .strict()

/** The message a value is, or null for any other value. */
export const messageOf = (value: unknown): Message | null => {
    const parsed = messageView.safeParse(value)
    return parsed.success ? parsed.data : null
}

/** A message text with each `{name}` the values name replaced in one pass; a placeholder with no value stays as written. */
export const filledMessage = (template: string, values: Message["values"]): string =>
    template.replaceAll(/\{(\w+)\}/gu, (placeholder, name: string) => {
        const value = values !== undefined && Object.hasOwn(values, name) ? values[name] : undefined
        return value === undefined ? placeholder : String(value)
    })

/**
 * The text a read's value stands for: a message is translated through its key in the words of the module and filled with its values
 * (reads return keys and values, never text), and a plain string or number draws as it is; anything else draws as nothing.
 */
export const messageTextOf = (value: unknown, translate: (key: string) => string): string => {
    const message = messageOf(value)
    return message === null ? textOf(value) : filledMessage(translate(message.key), message.values)
}
