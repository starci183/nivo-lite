const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** The bytes of an HTTP body read as bytes; an empty array for anything else. */
export const bytesOf = (body: unknown): Uint8Array => (body instanceof Uint8Array ? body : new Uint8Array())

/** One field of a value that may be an object; undefined for anything else. */
export const fieldOf = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined)

/** The text of a value when it is text, else undefined. */
export const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

/** The list inside a value when it is a list, else an empty list. */
export const listOf = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : [])
