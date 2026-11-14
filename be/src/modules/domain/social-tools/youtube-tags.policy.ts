/** The length of the tags the way YouTube counts it: each tag (a tag with a space counts its two quotation marks), plus one comma between tags. */
export const tagsLengthOf = (tags: ReadonlyArray<string>): number =>
    tags.reduce((sum, tag) => sum + tag.length + (tag.includes(" ") ? 2 : 0), 0) + Math.max(0, tags.length - 1)
