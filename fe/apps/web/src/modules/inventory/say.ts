import type { InventorySay } from "@/modules/types"

/** Whether every key of the catalog was read into the copy. */
const hasEveryKey = <Key extends string>(
    copy: Readonly<Record<string, string>>,
    keys: ReadonlyArray<Key>,
): copy is Readonly<Record<Key, string>> => keys.every((key) => key in copy)

/** The sentences of a drawer: each key of the catalog read under its own name. */
export const sayAll = <Key extends string>(
    say: InventorySay,
    keys: ReadonlyArray<Key>,
): Readonly<Record<Key, string>> => {
    const copy: Readonly<Record<string, string>> = Object.fromEntries(keys.map((key) => [key, say(key)]))
    if (!hasEveryKey(copy, keys)) throw new Error("A drawer sentence is missing")
    return copy
}
