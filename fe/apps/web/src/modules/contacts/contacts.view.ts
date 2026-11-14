import type { ContactModuleBlocksQuery, ContactQuery, ContactsQuery, ContactWorkQuery } from "@/modules/api"
import type {
    ContactDetailView,
    ContactFactView,
    ContactIdentityView,
    ContactListRowView,
    ContactModuleAgentView,
    ContactNoteView,
    ContactSuggestionView,
    ContactWords,
} from "@/modules/types"

/** One person as the list reads them. */
type ContactWire = ContactsQuery["contacts"]["contacts"][number]
/** One identity of a person, as both reads select it. */
type IdentityWire = ContactWire["identities"][number]
/** The detail read of a person (never null here: the caller handles a person who is gone). */
export type ContactDetailWire = NonNullable<ContactQuery["contact"]>

/** The brand each channel provider of an identity goes by: a name of a product, never translated. */
const PROVIDER_BRANDS: Readonly<Record<string, string>> = {
    zalo: "Zalo",
    zalo_oa: "Zalo",
    telegram: "Telegram",
    telegram_user: "Telegram",
    meta: "Facebook",
    facebook: "Facebook",
    messenger: "Facebook",
    web: "Web",
    website: "Web",
}

/** The mark each brand wears (public/logos/providers); a channel with no mark of its own shows the person's initial. */
const BRAND_LOGOS: Readonly<Record<string, string>> = {
    Zalo: "/logos/providers/zalo.svg",
    Telegram: "/logos/providers/telegram.svg",
    Facebook: "/logos/providers/meta.svg",
}

/** The most channel marks a list row draws before it stops. */
const CHANNELS_SHOWN = 4

/** The first letter a person's mark shows; "?" for a person nobody named. */
export const initialOf = (name: string | null): string => {
    const first = name?.trim().charAt(0) ?? ""
    return first === "" ? "?" : first.toUpperCase()
}

/** The brand of a channel provider ("zalo" is Zalo); an unknown provider is its own word with a capital, an empty one is none. */
export const brandOf = (provider: string): string | null => {
    if (provider === "") return null
    return PROVIDER_BRANDS[provider.toLowerCase()] ?? `${provider.charAt(0).toUpperCase()}${provider.slice(1)}`
}

/** The mark of a brand, when the app has one. */
export const logoOfBrand = (brand: string | null): string | null =>
    brand === null ? null : (BRAND_LOGOS[brand] ?? null)

/** The brands a person is reached on, in the order their identities were learned, each once. */
const channelBrandsOf = (identities: ReadonlyArray<IdentityWire>): ReadonlyArray<string> => {
    const brands: Array<string> = []
    for (const identity of identities) {
        const brand = identity.kind === "channel" ? brandOf(identity.provider) : null
        if (brand !== null && !brands.includes(brand)) brands.push(brand)
    }
    return brands
}

/** A phone in the Zalo form (`84901234567`) as a person reads it (`0901 234 567`); another form stays as it came. */
export const phoneTextOf = (value: string): string => {
    const digits = value.replaceAll(/\D/gu, "")
    const local = digits.startsWith("84") && digits.length >= 11 ? `0${digits.slice(2)}` : digits
    if (local.length !== 10 || !local.startsWith("0")) return value
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
}

/** The name a person goes by: their own, or the channel they were met on when nobody knows it ("Facebook guest"). */
export const nameOf = (contact: Pick<ContactWire, "displayName" | "identities">, words: ContactWords): string => {
    const name = contact.displayName?.trim() ?? ""
    if (name !== "") return name
    return words.unknownPerson(channelBrandsOf(contact.identities)[0] ?? null)
}

/** The phone and the mail a person can be reached on, as one muted line ("0901 234 567 · lan@gmail.com"). */
export const lineOf = (identities: ReadonlyArray<IdentityWire>): string => {
    const phone = identities.find((identity) => identity.kind === "phone")
    const mail = identities.find((identity) => identity.kind === "email")
    return [phone === undefined ? null : phoneTextOf(phone.value), mail?.value ?? null]
        .filter((part): part is string => part !== null)
        .join(" · ")
}

/** One row of the list: the name, when the person was last active and the channels they are on (their marks). */
export const contactRowOf = (contact: ContactWire, words: ContactWords): ContactListRowView => {
    const channels = channelBrandsOf(contact.identities)
        .slice(0, CHANNELS_SHOWN)
        .map((name) => ({ name, logo: logoOfBrand(name) }))
    return {
        id: contact.id,
        name: nameOf(contact, words),
        time: words.ago(contact.updatedAt),
        channels,
        isUnknown: (contact.displayName?.trim() ?? "") === "",
    }
}

/** What an identity is called on its row: "Zalo · Flower shop" for a channel id, else the kind of identity. */
const identityTitleOf = (identity: IdentityWire, words: ContactWords): string => {
    if (identity.kind === "phone") return words.kindPhone
    if (identity.kind === "email") return words.kindEmail
    const brand = brandOf(identity.provider)
    if (identity.kind === "channel") {
        const account = words.account(identity.account)
        const channel = brand ?? words.kindChannel
        return account === null ? channel : `${channel} · ${account}`
    }
    return brand ?? words.kindExternal
}

/** The way an identity is proven, in words: a claim nobody proved says so. */
const proofOf = (identity: IdentityWire, words: ContactWords): string => {
    if (!identity.verified) return words.proof.claimed
    if (identity.verifiedBy === "channel" || identity.verifiedBy === "token" || identity.verifiedBy === "member") {
        return words.proof[identity.verifiedBy]
    }
    return words.proof.verified
}

/** The words of why an identity came to this person by a merge; none for one the person was met with. */
const reasonOf = (joinedBy: string | null, words: ContactWords): string | null => {
    if (
        joinedBy === "phone_verified" ||
        joinedBy === "email_verified" ||
        joinedBy === "link_token" ||
        joinedBy === "member_approved"
    ) {
        return words.reason[joinedBy]
    }
    return null
}

/** The phone or the mail an identity holds; null for any other kind. */
const wayValueOf = (identity: IdentityWire): string | null => {
    if (identity.kind === "phone") return phoneTextOf(identity.value)
    return identity.kind === "email" ? identity.value : null
}

/** The words that say a person on a channel account is held by the staff: "Held by An"; none when the agents speak on it. */
const holdOf = (
    identity: IdentityWire,
    routes: ContactDetailWire["routes"],
    words: ContactWords,
): string | null => {
    if (identity.kind !== "channel") return null
    const holder = routes.find((route) => route.accountId === identity.account)?.holder
    if (holder === undefined || holder === null) return null
    const name = holder.name?.trim() ?? ""
    return words.hold(name === "" ? null : name)
}

/** One identity row: what it is, the phone or mail it holds, why it is linked (the merge reason, else how it is proven) and, on a channel the staff hold, who holds it. */
export const identityOf = (
    identity: IdentityWire,
    routes: ContactDetailWire["routes"],
    words: ContactWords,
): ContactIdentityView => {
    const brand = identity.kind === "phone" || identity.kind === "email" ? null : brandOf(identity.provider)
    return {
        id: identity.id,
        title: identityTitleOf(identity, words),
        description: wayValueOf(identity),
        logo: logoOfBrand(brand),
        why: reasonOf(identity.joinedBy, words) ?? proofOf(identity, words),
        hold: holdOf(identity, routes, words),
    }
}

/** The facts the agents remember, one row each; a fact the agents hold no value of is left out. */
export const contactFactsOf = (memory: ContactDetailWire["memory"]): ReadonlyArray<ContactFactView> =>
    memory.facts.map((fact) => ({ name: fact.name, value: fact.value }))

/** The work the agents did for a person, as the back end labels it. */
export type ContactWorkWire = ContactWorkQuery["contactWork"]

/** What a piece of work is called: "<workflow> · <step>", the workflow alone when the step has no label, the neutral word when neither has one. */
const workTitleOf = (work: ContactWorkWire[number], words: ContactWords): string => {
    const workflow = work.workflowLabel?.trim() ?? ""
    const step = work.stepLabel?.trim() ?? ""
    if (workflow === "") return step === "" ? words.noteUnknownWork : step
    return step === "" ? workflow : `${workflow} · ${step}`
}

/**
 * The work the agents did, newest first as the back end orders it: what it was (workflow and step labels), how it ended (done, failed
 * or passed over) and when. The round of a repeated step ("round 2") is added only to rows that would otherwise read the same.
 */
export const contactNotesOf = (work: ContactWorkWire, words: ContactWords): ReadonlyArray<ContactNoteView> => {
    const titles = work.map((one) => workTitleOf(one, words))
    const sameTitle = (title: string): number => titles.filter((one) => one === title).length
    return work.map((one, index) => {
        const title = titles[index] ?? ""
        const round = sameTitle(title) < 2 ? null : (one.round ?? null)
        return {
            id: one.id,
            title: round === null ? title : `${title} · ${words.noteRound(round)}`,
            status: words.noteStatus(one.status),
            time: words.ago(one.at),
        }
    })
}

/** The reason a person may be someone already known, in words. */
const suggestionWhyOf = (suggestion: ContactDetailWire["suggestions"][number], words: ContactWords): string => {
    if (suggestion.why === "claimed_identity") return words.whyClaimed
    if (suggestion.why === "same_name") return words.whySameName
    return suggestion.why
}

/** The name of a suggested person: their own, or the word for a person nobody named. */
const nameOfSuggestion = (displayName: string | null, words: ContactWords): string => {
    const name = displayName?.trim() ?? ""
    return name === "" ? words.unknownPerson(null) : name
}

/** The people who may be the same person, each with the reason, never applied by itself. */
export const contactSuggestionsOf = (
    suggestions: ContactDetailWire["suggestions"],
    words: ContactWords,
): ReadonlyArray<ContactSuggestionView> =>
    suggestions.map((suggestion) => ({
        contactId: suggestion.contactId,
        name: nameOfSuggestion(suggestion.displayName, words),
        why: suggestionWhyOf(suggestion, words),
    }))

/** What the detail needs beyond the read: how a path becomes an address in the workspace, and whether the viewer may delete. */
interface DetailOptions {
    readonly canDelete: boolean
    /** The work the agents did for the person (its own read); none until read. */
    readonly work: ContactWorkWire | undefined
}

/** Everything the detail of one person draws, worded. */
export const detailOf = (
    detail: ContactDetailWire,
    words: ContactWords,
    options: DetailOptions,
): ContactDetailView => ({
    id: detail.contact.id,
    name: nameOf(detail.contact, words),
    initial: initialOf(detail.contact.displayName),
    line: lineOf(detail.contact.identities),
    displayName: detail.contact.displayName ?? "",
    tags: detail.contact.tags,
    identities: detail.contact.identities.map((identity) => identityOf(identity, detail.routes, words)),
    facts: contactFactsOf(detail.memory),
    notes: contactNotesOf(options.work ?? [], words),
    suggestions: contactSuggestionsOf(detail.suggestions, words),
    canDelete: options.canDelete,
})

/** The tags of a form field typed as one line: the words between commas, trimmed, none empty and none twice. */
export const tagsOfText = (text: string): ReadonlyArray<string> => {
    const tags: Array<string> = []
    for (const part of text.split(",")) {
        const tag = part.trim()
        if (tag !== "" && !tags.includes(tag)) tags.push(tag)
    }
    return tags
}

/** What each installed agent's module knows about the person, as the back end answers it. */
export type ContactModulesWire = ContactModuleBlocksQuery["contactModuleBlocks"]

/** The agents of a person's module blocks: each with the rows its blocks hold and whether any block has more than it shows. */
export const moduleAgentsOf = (agents: ContactModulesWire): ReadonlyArray<ContactModuleAgentView> =>
    agents.map((agent) => ({
        installationId: agent.installationId,
        moduleKey: agent.moduleKey,
        name: agent.agentName,
        count: agent.blocks.reduce((sum, block) => sum + block.count, 0),
        hasMore: agent.blocks.some((block) => block.hasMore),
        blocks: agent.blocks.map((block) => ({
            id: block.id,
            title: block.title,
            nodeJson: block.nodeJson,
            dataJson: block.dataJson,
            count: block.count,
        })),
    }))
