/** The named parameters of one statement: values are bound here and only their names reach the statement text. */
export interface ParamBag {
    /** Stores a value and answers its parameter name (without the colon). */
    bind(value: unknown): string
    /** Every value bound so far, by name. */
    values(): Readonly<Record<string, unknown>>
}

/** A fresh bag; its names are `<prefix>0`, `<prefix>1`, ... in binding order. */
export const paramBag = (prefix: string): ParamBag => {
    const store = new Map<string, unknown>()
    return {
        bind: (value) => {
            const name = `${prefix}${String(store.size)}`
            store.set(name, value)
            return name
        },
        values: () => Object.fromEntries(store),
    }
}
