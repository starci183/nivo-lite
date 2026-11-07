/** Archived conversations carry `<chat id>:<timestamp>`; the customer's id on the channel is the part before the colon. */
export const customerIdOf = (externalId: string): string => {
    // A suffix belongs to the final logical line; earlier line breaks keep their stored text.
    const lineStart =
        Math.max(
            externalId.lastIndexOf("\n"),
            externalId.lastIndexOf("\r"),
            externalId.lastIndexOf("\u2028"),
            externalId.lastIndexOf("\u2029"),
        ) + 1
    const suffix = externalId.indexOf(":", lineStart)
    return suffix < 0 ? externalId : externalId.slice(0, suffix)
}
