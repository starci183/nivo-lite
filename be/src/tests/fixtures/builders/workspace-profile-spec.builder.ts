/** A profile document of the given title: an internal note with no module and the title as its heading. */
export const profileDocumentOf = (title: string) => ({
    title,
    topic: "topic",
    module: null,
    visibility: "internal" as const,
    content: `# ${title}`,
})
