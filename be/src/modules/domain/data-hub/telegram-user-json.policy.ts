/** The outcome of reading JSON text: the value, or the error the parser raised. */
export type TelegramJsonRead =
    { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly cause: unknown }

/** Reads JSON text without throwing. */
export const readJson = (text: string): TelegramJsonRead => {
    try {
        return { ok: true, value: JSON.parse(text) }
    } catch (cause) {
        return { ok: false, cause }
    }
}
