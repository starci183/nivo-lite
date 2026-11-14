import type {
    ContactSuggestion,
    IdentityKey,
    IdentityMatch,
    MergeReason,
    NormalIdentity,
    Resolution,
    ResolvedMerge,
    ResolveInput,
} from "./contacts.contracts"
import { identityKeyText, keyOf } from "./contact-identity.policy"

/**
 * The reason a VERIFIED identity proves two contacts are one person: an exact verified phone or mail. A channel's user id or an outside
 * system's id only says which contact it is; it proves no merge on its own.
 */
export const mergeReasonOf = (identity: IdentityKey): MergeReason | null => {
    if (identity.kind === "phone") return "phone_verified"
    if (identity.kind === "email") return "email_verified"
    return null
}

/** A contact the incoming person is, by what: identified (a channel / outside id it holds) or proven (a merge reason). */
interface Found {
    readonly contactId: string
    readonly createdAt: string
    readonly reason: MergeReason | null
}

/** The older contact first (it survives a merge), then the smaller id: one order for every caller. */
const olderFirst = (left: Found, right: Found): number =>
    left.createdAt === right.createdAt ? left.contactId.localeCompare(right.contactId) : left.createdAt.localeCompare(right.createdAt)

/** The first reason of each contact, kept once per contact, in the order found. */
const byContact = (found: ReadonlyArray<Found>): ReadonlyArray<Found> => {
    const seen = new Map<string, Found>()
    for (const one of found) {
        const held = seen.get(one.contactId)
        if (held === undefined || (held.reason === null && one.reason !== null)) seen.set(one.contactId, one)
    }
    return [...seen.values()]
}

/** The suggestions, one per contact (the first why), never one about a contact of the resolved person. */
const suggestionsOf = (all: ReadonlyArray<ContactSuggestion>, own: ReadonlySet<string>): ReadonlyArray<ContactSuggestion> => {
    const seen = new Set<string>()
    return all.filter((one) => {
        if (own.has(one.contactId) || seen.has(one.contactId)) return false
        seen.add(one.contactId)
        return true
    })
}

/**
 * Who an incoming person is, by the owner's identity rules (contacts.md), on exact comparisons of normalised identifiers only:
 *  1. a channel's or an outside system's id a contact holds IS that contact (the provider vouches for its own id);
 *  2. an incoming VERIFIED phone or mail equal to one a contact holds VERIFIED, or a valid one-time link token, proves the person is that
 *     contact: when it is not the one rule 1 found, the two merge (the older survives), for that reason;
 *  3. a SELF-DECLARED phone or mail (no proof) is kept as a claim on the person and never merges; equal to another contact's identity, it
 *     is a suggestion; so is a verified identity equal to another contact's mere claim;
 *  4. a same display name is a suggestion only;
 *  5. nothing of another workspace is ever looked at.
 * Nobody identified or proven: a new contact. `attach` is every incoming identity the resolved contacts do not hold yet.
 */
export const resolveContact = (workspaceId: string, input: ResolveInput): Resolution => {
    const matches = input.matches.filter((match) => match.workspaceId === workspaceId)
    const names = input.names.filter((name) => name.workspaceId === workspaceId)
    const token = input.token?.workspaceId === workspaceId ? input.token : null
    const incomingByKey = new Map(input.incoming.map((identity) => [identityKeyText(identity), identity]))
    const incomingOf = (match: IdentityMatch): NormalIdentity | undefined => incomingByKey.get(identityKeyText(match.key))

    const identified: Array<Found> = []
    const proven: Array<Found> = []
    for (const match of matches) {
        const incoming = incomingOf(match)
        if (incoming === undefined || !match.verified) continue
        const found = { contactId: match.contactId, createdAt: match.contactCreatedAt }
        if (match.key.kind === "channel" || match.key.kind === "external") identified.push({ ...found, reason: null })
        else if (incoming.proof !== null) proven.push({ ...found, reason: mergeReasonOf(match.key) })
    }
    if (token !== null) proven.push({ contactId: token.contactId, createdAt: token.createdAt, reason: "link_token" })

    const provenOnce = byContact(proven)
    const reasonOfProof = provenOnce[0]?.reason ?? null
    // A contact rule 1 found joins by the proof the person brought: without a proof, two identified contacts stay two (a suggestion).
    const joined = byContact([...provenOnce, ...identified.map((one) => ({ ...one, reason: reasonOfProof }))])
    const candidates = provenOnce.length > 0 ? joined : byContact(identified).toSorted(olderFirst).slice(0, 1)
    const [target, ...others] = candidates.toSorted(olderFirst)
    const merges: ReadonlyArray<ResolvedMerge> = others.flatMap((one) => (one.reason === null ? [] : [{ from: one.contactId, reason: one.reason }]))
    const own = new Set([...(target === undefined ? [] : [target.contactId]), ...merges.map((merge) => merge.from)])

    const heldByOwn = (identity: NormalIdentity): boolean =>
        matches.some((match) => own.has(match.contactId) && identityKeyText(match.key) === identityKeyText(identity))
    const attach = input.incoming.filter((identity) => !heldByOwn(identity))

    const claimed: ReadonlyArray<ContactSuggestion> = matches.flatMap((match) => {
        const incoming = incomingOf(match)
        if (incoming === undefined) return []
        const isPerson = match.key.kind === "phone" || match.key.kind === "email"
        const unproven = incoming.proof === null || !match.verified
        const identifiedOnly = !isPerson && provenOnce.length === 0
        return (isPerson && unproven) || identifiedOnly
            ? [{ contactId: match.contactId, why: "claimed_identity" as const, identity: keyOf(match.key) }]
            : []
    })
    const sameName: ReadonlyArray<ContactSuggestion> = names.map((name) => ({ contactId: name.contactId, why: "same_name", identity: null }))
    const suggestions = suggestionsOf([...claimed, ...sameName], own)

    return target === undefined
        ? { outcome: "create", attach, suggestions }
        : { outcome: "contact", contactId: target.contactId, attach, merges, suggestions }
}
