import superjson from "superjson"

/** Serializes any value (dates, maps, sets, bigint) to a string the storage module keeps. */
export const serialize = (value: unknown): string => superjson.stringify(value)

/** Restores a value serialized by {@link serialize}; text that is not a serialized value gives `undefined`. */
export const deserialize = <T>(text: string): T | undefined => {
    try {
        return superjson.parse<T>(text)
    } catch {
        return undefined
    }
}
