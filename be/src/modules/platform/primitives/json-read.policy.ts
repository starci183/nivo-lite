import type { JsonRead } from "./json-read.contracts"

/** Parses untrusted JSON text (a stored secret, a signed state, a provider reply) into an outcome that carries the parse error. */
export const parseJsonText = (text: string): JsonRead => {
    try {
        return { ok: true, value: JSON.parse(text) }
    } catch (cause) {
        return { ok: false, cause }
    }
}
