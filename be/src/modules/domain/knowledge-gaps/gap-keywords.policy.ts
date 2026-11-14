/** A topic guess split into the subject and the attribute the answer would be filed under. */
export interface TopicSplit {
    /** The subject, or null. */
    readonly subject: string | null
    /** The attribute, or null. */
    readonly attribute: string | null
}

/** A trimmed part, or null when it is missing or blank. */
const partOrNull = (part: string | undefined): string | null => (part === undefined || part === "" ? null : part)

/** A topic written "subject | attribute" becomes its two parts. */
export const splitTopic = (raw: string | null | undefined): TopicSplit => {
    const [subject, attribute] = (raw ?? "").split("|").map((part) => part.trim().slice(0, 120))
    return { subject: partOrNull(subject), attribute: partOrNull(attribute) }
}
