/** The image of the NIVO AI preset. */
const NIVO_AI_PICTURE = "/nivo-ai.png"

/** The preset pictures an agent may wear instead of an upload (the back end accepts the same keys). */
const AGENT_AVATAR_PRESETS = [
    "nivo-ai",
    "role",
    "initials",
    "mascot",
    "mascot-chat",
    "mascot-point",
    "mascot-offer",
] as const

/** One preset key. */
type AgentAvatarPreset = (typeof AGENT_AVATAR_PRESETS)[number]

/** The preset keys as a set of plain texts, for the membership check of a stored text. */
const PRESET_KEYS: ReadonlySet<string> = new Set(AGENT_AVATAR_PRESETS)

/** Whether a stored text is a preset key. */
const isAgentAvatarPreset = (value: string): value is AgentAvatarPreset => PRESET_KEYS.has(value)

/** The image of each preset that is a fixed image; the role mark and the initials depend on the agent. */
const FIXED_PICTURES: Readonly<Record<Exclude<AgentAvatarPreset, "role" | "initials">, string>> = {
    "nivo-ai": NIVO_AI_PICTURE,
    mascot: "/images/agents/mascot-avatar.webp",
    "mascot-chat": "/images/promo/mascot-chat.png",
    "mascot-point": "/images/promo/mascot-point.png",
    "mascot-offer": "/images/promo/mascot-offer.png",
}

/** The facts the picture of an agent is drawn from. */
interface AgentPictureFacts {
    /** The picture the owner uploaded; it wins over everything. */
    readonly avatarUrl: string | null | undefined
    /** The preset the owner chose; none draws the default sprout. */
    readonly avatarPreset: string | null | undefined
    /** The role, for the role's 3D mark. */
    readonly moduleKey: string
}

/** The first choice of the picker: no picture, so Grammar draws the sprout seeded by the name (the default of every agent). */
const SPROUT_CHOICE: "sprout" = "sprout"

/** The choices of the picture picker, in order: the default sprout, then every preset. */
export const PICTURE_CHOICES: readonly ["sprout", ...typeof AGENT_AVATAR_PRESETS] = [
    SPROUT_CHOICE,
    ...AGENT_AVATAR_PRESETS,
]

/** One choice of the picture picker. */
export type PictureChoiceKey = (typeof PICTURE_CHOICES)[number]

/** The picker choices as a set of plain texts, for the membership check of a text. */
const CHOICE_KEYS: ReadonlySet<string> = new Set(PICTURE_CHOICES)

/** Whether a text is a choice of the picture picker. */
export const isPictureChoice = (value: string): value is PictureChoiceKey => CHOICE_KEYS.has(value)

/** The preset a choice stores: none for the default sprout. */
export const storedPresetOf = (choice: PictureChoiceKey): string | null => (choice === SPROUT_CHOICE ? null : choice)

/** The image a choice draws for an agent of a role; null for the sprout and the initials (Grammar draws both). */
export const choiceSrcOf = (choice: PictureChoiceKey, moduleKey: string): string | null =>
    choice === SPROUT_CHOICE ? null : presetSrcOf(choice, moduleKey)

/** The image a preset stands for, for an agent of a role; null for the initials. */
const presetSrcOf = (preset: AgentAvatarPreset, moduleKey: string): string | null => {
    if (preset === "initials") return null
    if (preset === "role") return `/agents/${moduleKey}.webp`
    return FIXED_PICTURES[preset]
}

/**
 * The address every screen draws an agent's picture from: the upload, else the image of its preset; null for the default sprout
 * (the screens draw it themselves) and for the initials preset (read `avatarPreset` to draw them).
 */
export const pictureUrlOf = (facts: AgentPictureFacts): string | null => {
    if (facts.avatarUrl !== null && facts.avatarUrl !== undefined && facts.avatarUrl !== "") return facts.avatarUrl
    const preset = facts.avatarPreset ?? ""
    return isAgentAvatarPreset(preset) ? presetSrcOf(preset, facts.moduleKey) : null
}

/** The longest handle the back end keeps. */
const AGENT_HANDLE_MAX = 32

/** The words of a text, lowercased with the Vietnamese marks folded (the barred d to "d"), joined by single hyphens. */
const slugOf = (text: string): string =>
    text
        .toLowerCase()
        .replaceAll(String.fromCodePoint(0x111), "d")
        .normalize("NFD")
        .replaceAll(/\p{M}+/gu, "")
        .split(/[^a-z0-9]+/u)
        .filter((part) => part !== "")
        .join("-")

/**
 * The @handle suggested for a new agent: the role handle with the name after it ("sales-lan" for Lan of Sales), the name alone when it
 * already starts with the role. The back end makes it unique (sales-lan-2) when it is taken.
 */
export const suggestedHandleOf = (name: string, roleHandle: string): string => {
    const slug = slugOf(name)
    if (slug === "" || slug === roleHandle) return roleHandle
    const joined = slug.startsWith(`${roleHandle}-`) ? slug : `${roleHandle}-${slug}`
    return slugOf(joined.slice(0, AGENT_HANDLE_MAX))
}
