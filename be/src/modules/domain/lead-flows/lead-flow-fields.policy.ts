import type { ProposalFieldValue } from "@modules/domain/work-items"
import { contactIn, normEmail, normPhone, textOf, textOrNull } from "./lead-flow-identity.policy"
import { leadSourceOf, platformOf, sourceKindOf } from "./lead-flow.mapper"
import type { Identity, LeadSource, Referral } from "./lead-flows.contracts"

/** The fields of a lead_gen proposal. */
export type FlowFields = Readonly<Record<string, ProposalFieldValue>>

/** The text of a field, or "". */
export const field = (fields: FlowFields, key: string): string => textOf(fields[key])

/** What parsing a JSON text gave: the value, or the error that stopped it. */
export interface JsonParse {
    /** The parsed value; undefined when the text was not JSON. */
    readonly value: unknown
    /** Why the text was not JSON, or null. */
    readonly error: unknown
}

/** Parses a JSON text into a value, or the error. */
export const jsonOf = (raw: string): JsonParse => {
    try {
        return { value: JSON.parse(raw), error: null }
    } catch (error) {
        return { value: undefined, error }
    }
}

const referralIn = (raw: string): Referral | null =>
    raw === "" ? null : (leadSourceOf({ kind: "dm", referral: jsonOf(raw).value })?.referral ?? null)

/** The ISO instant of the `message_at` field (ms since the epoch), or the fallback. */
export const messageAtOf = (fields: FlowFields, fallback: string): string => {
    const at = Number(fields.message_at)
    return Number.isFinite(at) && at > 0 ? new Date(at).toISOString() : fallback
}

/** The touch a capture command carries. */
export const sourceOf = (fields: FlowFields, now: string): LeadSource => ({
    platform:
        field(fields, "platform") === "instagram" || /instagram/i.test(field(fields, "channel_label"))
            ? "instagram"
            : platformOf(field(fields, "platform")),
    kind: sourceKindOf(field(fields, "source_kind"), "leadgen"),
    post_id: textOrNull(fields.post_id),
    ad_id: textOrNull(fields.ad_id),
    form_id: textOrNull(fields.form_id),
    comment_id: textOrNull(fields.comment_id),
    leadgen_id: textOrNull(fields.leadgen_id),
    referral: referralIn(field(fields, "referral")),
    at: messageAtOf(fields, now),
})

/** The identity keys a capture command carries. */
export const identityOf = (fields: FlowFields): Identity => {
    const fromContact = contactIn(field(fields, "contact"))
    return {
        psid: textOrNull(fields.psid),
        igsid: textOrNull(fields.igsid),
        phone: normPhone(fields.phone) ?? fromContact.phone ?? normPhone(fields.contact),
        email: normEmail(fields.email) ?? fromContact.email,
    }
}

/** The channel key of a touch, for its label. */
export const channelKeyOf = (source: LeadSource): string => {
    if (source.kind === "leadgen") return "lead-ads"
    if (source.platform === "instagram") return `instagram-${source.kind === "dm" ? "dm" : source.kind}`
    return source.kind === "dm" ? "facebook-dm" : "facebook-comment"
}

/** Only the fields that hold a value. */
export const keep = (fields: FlowFields, ...keys: ReadonlyArray<string>): Record<string, ProposalFieldValue> =>
    Object.fromEntries(
        keys
            .map((key): readonly [string, ProposalFieldValue | undefined] => [key, fields[key]])
            .filter(
                (entry): entry is readonly [string, ProposalFieldValue] =>
                    entry[1] !== undefined && entry[1] !== null && entry[1] !== "",
            ),
    )
