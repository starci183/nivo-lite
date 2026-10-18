/** A public slug from the shop name, bounded for the database's slug check. */
export const programSlug = (name: string): string => {
    const slug = name
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/\u0111/giu, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "-")
        .slice(0, 28)
        .replace(/^-|-$/gu, "")
    return slug.length >= 3 ? slug : `${slug || "cua"}-hang`
}
