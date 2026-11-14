/** The kinds a person links. */
const LINK_KINDS = ["phone", "email", "external"] as const

/** The kind of identity a person links named by text: the named kind, or `phone` for any other text. */
export const linkKindOf = (kind: string): (typeof LINK_KINDS)[number] => LINK_KINDS.find((one) => one === kind) ?? "phone"
