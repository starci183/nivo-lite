/**
 * The JSON of a value with the members of every object in name order (an undefined member left out), so equal data always has the
 * same text. Written here, in plain code, because this file is also built for the browser, where no Node module can be imported.
 */
export const stableJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map((item: unknown) => stableJson(item)).join(",")}]`
    if (typeof value === "object" && value !== null) {
        return `{${Object.entries(value)
            .filter(([, member]) => member !== undefined)
            .sort(([left], [right]) => (left < right ? -1 : 1))
            .map(([name, member]) => `${JSON.stringify(name)}:${stableJson(member)}`)
            .join(",")}}`
    }
    return JSON.stringify(value) ?? "null"
}

/** The seeds and the multipliers of the two 32-bit halves of a text's digest. */
const DIGEST_SEEDS: readonly [number, number] = [0xdeadbeef, 0x41c6ce57]
const DIGEST_STEPS: readonly [number, number] = [2654435761, 1597334677]
const DIGEST_MIXES: readonly [number, number] = [2246822507, 3266489909]

/** The first code point outside the basic plane, and the high surrogate that starts every pair. */
const ASTRAL_START = 0x10000
const HIGH_SURROGATE_START = 0xd800

/** A 32-bit half as eight hex digits. */
const hex8 = (half: number): string => (half >>> 0).toString(16).padStart(8, "0")

/**
 * The UTF-16 code unit at `index`: the code point when it fits one unit, else the high surrogate of its pair (a low surrogate
 * position reads back as itself). The digest is defined over code units, so stored digests keep their values on every host.
 */
const unitAt = (text: string, index: number): number => {
    const point = Number(text.codePointAt(index))
    return point < ASTRAL_START ? point : HIGH_SURROGATE_START + ((point - ASTRAL_START) >> 10)
}

/**
 * The digest of a text: sixteen hex digits (64 bits) from two 32-bit halves mixed over its UTF-16 code units. It is no secret and
 * guards nothing: it only tells the few calls of one step apart, the same on every host, with no Node module.
 */
const textDigestOf = (text: string): string => {
    let [first, second] = DIGEST_SEEDS
    for (let index = 0; index < text.length; index += 1) {
        const unit = unitAt(text, index)
        first = Math.imul(first ^ unit, DIGEST_STEPS[0])
        second = Math.imul(second ^ unit, DIGEST_STEPS[1])
    }
    const mixedFirst =
        Math.imul(first ^ (first >>> 16), DIGEST_MIXES[0]) ^ Math.imul(second ^ (second >>> 13), DIGEST_MIXES[1])
    const mixedSecond =
        Math.imul(second ^ (second >>> 16), DIGEST_MIXES[0]) ^ Math.imul(first ^ (first >>> 13), DIGEST_MIXES[1])
    return `${hex8(mixedSecond)}${hex8(mixedFirst)}`
}

/**
 * What tells one call of a step from another: the tool or effect and its parsed arguments, whatever their member order. A step that
 * runs again makes its calls in whatever order its agent chooses, so the place of a call says nothing: a replay must only ever answer
 * the same tool asked the same thing.
 */
export const callDigestOf = (id: string, args: Readonly<Record<string, unknown>>): string =>
    textDigestOf(stableJson([id, args]))
