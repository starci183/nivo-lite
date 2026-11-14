import type { SpecText } from "@nivo-lite/agent-sdk/schema"

/** The words of the values a record holds, by path: for the path `stage`, the value `won` is drawn as the words under `stage.won`. */
export type ValueLabels = Readonly<Record<string, Readonly<Record<string, SpecText>>>>

/** What a block draws for the raw text a path holds. */
export type Relabel = (path: string, raw: string) => string

/** The entry a record holds under its own key; keys of the prototype (`constructor`, `toString`) are never entries. */
const entryOf = <T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined =>
    record !== undefined && Object.hasOwn(record, key) ? record[key] : undefined

/** Draws a raw value as the words the spec gave it at its path; a value with no words draws as it is. */
export const relabeller =
    (labels: ValueLabels | undefined, words: (text: SpecText) => string): Relabel =>
    (path, raw) => {
        const label = entryOf(entryOf(labels, path), raw)
        return label === undefined ? raw : words(label)
    }

/** A relabel that draws every value as it is, for a block that was given no labels. */
export const keepRaw: Relabel = (_path, raw) => raw
