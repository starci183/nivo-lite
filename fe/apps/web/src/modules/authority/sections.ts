/** The five sections of the authority page, in the order of the operating flow; each is one address. */
export const AUTHORITY_SECTIONS = ["goals", "policies", "scope", "limits", "staff"] as const

/** One section of the authority page. */
export type AuthoritySectionId = (typeof AUTHORITY_SECTIONS)[number]

/** The section an address names, or null when it names none of the five. */
export const authoritySectionOf = (value: string): AuthoritySectionId | null =>
    AUTHORITY_SECTIONS.find((one) => one === value) ?? null
