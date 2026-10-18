/** The values a message body is previewed with: the sample customer and the neutral words for blanks. */
export type MessageVars = Readonly<Record<string, string | undefined>>

/** Fills the {variable} blanks of a body; an empty value reads as the neutral word, never as a raw {placeholder}. */
export const fillBody = (body: string, variables: MessageVars, neutral: MessageVars): string =>
    body
        .replace(/\{([a-z_]+)\}/g, (_, key: string) => (variables[key] ?? "").trim() || (neutral[key] ?? ""))
        .replace(/[ \t]{2,}/g, " ")
        .replace(/[ \t]([.,!?])/g, "$1")
        .trim()
