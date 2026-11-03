type ProfileDocumentOfResultShape = {
    title: string
    topic: string
    module: null
    visibility: "internal"
    content: string
}

/** A profile document of the given title: an internal note with no module and the title as its heading. */
export const profileDocumentOf = (title: string): ProfileDocumentOfResultShape => ({
    title,
    topic: "topic",
    module: null,
    visibility: "internal" as const,
    content: `# ${title}`,
})
