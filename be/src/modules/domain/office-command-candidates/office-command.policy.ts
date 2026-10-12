import type { AcceptedCommand } from "@modules/domain/decisions"
import type { ProposedCommand } from "@modules/integrations/deepseek"
import { DomainError } from "@modules/platform/errors"
import type { Locale } from "@modules/platform/i18n"
import type {
    CardLabels,
    LeadRef,
    MessageRefs,
    NeedText,
    OrderRef,
    ReadyResolution,
    Resolution,
    ShownRow,
} from "./office.contracts"

/** Handles ("@ke-toan") named in a message, lower case, in order, without repeats. */
export const mentionedHandles = (body: string): ReadonlyArray<string> => [
    ...new Set(body.match(/(?<=@)[a-z0-9-]+/g) ?? []),
]

/** The Vietnamese letter d with a stroke, which has no accent form to strip. */
const D_WITH_STROKE = String.fromCodePoint(0x111)

/** Lower case, no accents (d with stroke becomes d): how names and order numbers are compared. */
export const fold = (text: string): string =>
    text.normalize("NFD").toLowerCase().replace(/\p{M}/gu, "").replaceAll(D_WITH_STROKE, "d")

/** The message as comparable tokens: mentions removed, folded, "#DH-1" becomes "dh1". */
const tokensOf = (body: string): ReadonlyArray<string> =>
    fold(body.replace(/@[a-z0-9-]+/gi, " "))
        .split(/[\s,;:!?()"“”]+/)
        .map((token) => token.replace(/^#/, "").replace(/[^a-z0-9]/g, ""))
        .filter((token) => token !== "")

const orderKey = (orderNo: string): string => fold(orderNo).replace(/[^a-z0-9]/g, "")

/** Orders whose number the message names ("#DH-12", "dh12"). */
export const matchOrders = (body: string, orders: ReadonlyArray<OrderRef>): ReadonlyArray<OrderRef> => {
    const tokens = new Set(tokensOf(body))
    return orders.filter((order) => {
        const key = orderKey(order.orderNo)
        return key !== "" && tokens.has(key)
    })
}

const phraseOf = (text: string): string => tokensOf(text).join(" ")

const FULL_NAME = 3
const COMPANY = 2
const GIVEN_NAME = 1
const MIN_COMPANY = 3
const MIN_GIVEN = 3

const containsPhrase = (text: string, phrase: string): boolean => phrase !== "" && text.includes(` ${phrase} `)

const strengthOf = (text: string, lead: LeadRef): number => {
    const full = phraseOf(lead.name)
    const given = full.slice(full.lastIndexOf(" ") + 1)
    const company = lead.company === null ? "" : phraseOf(lead.company)
    if (containsPhrase(text, full)) return FULL_NAME
    if (company.length >= MIN_COMPANY && containsPhrase(text, company)) return COMPANY
    return given.length >= MIN_GIVEN && containsPhrase(text, given) ? GIVEN_NAME : 0
}

/**
 * Customers the message names: the full name (strongest), else the company, else the given name (last word, at least 3 letters).
 * Only the strongest tier is returned, so "Lan" does not beat "Nguyen Thi Lan" when both are in the list.
 */
export const matchLeads = (body: string, leads: ReadonlyArray<LeadRef>): ReadonlyArray<LeadRef> => {
    const text = ` ${tokensOf(body).join(" ")} `
    const scored = leads.map((lead) => ({ lead, strength: strengthOf(text, lead) }))
    const best = Math.max(0, ...scored.map((entry) => entry.strength))
    return best === 0 ? [] : scored.filter((entry) => entry.strength === best).map((entry) => entry.lead)
}

/** What an agent accepts, joined for the reply when a message maps to nothing. */
export const acceptsText = (locale: Locale, accepts: ReadonlyArray<AcceptedCommand>): string =>
    accepts.map((accepted) => accepted.description[locale]).join("; ")

const ID_KEYS: ReadonlyArray<string> = ["subject_id", "lead_id"]

const soleOf = <T>(items: ReadonlyArray<T>): T | undefined => (items.length === 1 ? items[0] : undefined)

interface Addressed {
    readonly payload: Record<string, unknown>
    readonly leadId: string | null
    readonly orderId: string | null
}

const addressOrder = (choice: ProposedCommand, refs: MessageRefs, payload: Record<string, unknown>): Addressed => {
    const wanted = choice.subject_id ?? choice.lead_id
    const order = refs.orders.find((candidate) => candidate.id === wanted) ?? soleOf(refs.orders)
    if (order === undefined) return { payload, leadId: null, orderId: null }
    const withOrder = { ...payload, subject_id: order.id }
    return {
        payload: order.leadId === null ? withOrder : { ...withOrder, lead_id: order.leadId },
        leadId: order.leadId,
        orderId: order.id,
    }
}

const addressLead = (choice: ProposedCommand, refs: MessageRefs, payload: Record<string, unknown>): Addressed => {
    const wanted = choice.subject_id ?? choice.lead_id
    const named = refs.leads.find((candidate) => candidate.id === wanted)?.id
    const leadId = named ?? soleOf(refs.leads)?.id ?? soleOf(refs.orders)?.leadId ?? null
    return {
        payload: leadId === null ? payload : { ...payload, subject_id: leadId, lead_id: leadId },
        leadId,
        orderId: null,
    }
}

const addressOf = (
    subjectType: string,
    choice: ProposedCommand,
    refs: MessageRefs,
    payload: Record<string, unknown>,
): Addressed => {
    if (subjectType === "order") return addressOrder(choice, refs, payload)
    if (subjectType === "lead") return addressLead(choice, refs, payload)
    return { payload, leadId: null, orderId: null }
}

/**
 * Validates the model's choice against the agent's contract. `refs` are the references the message named (the only ids the model was
 * offered): an id outside them is dropped, and a single named reference is used when the model left the id out. A command that is not
 * in the list, or a missing required key, never becomes a candidate.
 */
export const resolveCandidate = (
    choice: ProposedCommand,
    accepts: ReadonlyArray<AcceptedCommand>,
    refs: MessageRefs,
): Resolution => {
    const accepted = accepts.find((candidate) => candidate.command === choice.command)
    if (accepted === undefined) return { kind: "unmapped" }
    const addressed = addressOf(accepted.subjectType, choice, refs, { subject_type: accepted.subjectType })
    const extra: Record<string, string | number> = {}
    const payload: Record<string, unknown> = { ...addressed.payload }
    const missing: Array<string> = []
    for (const key of accepted.requiredFields) {
        const value = choice.fields[key]
        if (ID_KEYS.includes(key)) {
            if (payload[key] === undefined) missing.push(key)
        } else if (value === undefined) {
            missing.push(key)
        } else {
            extra[key] = value
            payload[key] = value
        }
    }
    const common = { command: accepted.command, description: accepted.description }
    if (missing.length > 0) return { kind: "missing", ...common, subjectType: accepted.subjectType, missing }
    return { kind: "ok", ...common, payload, leadId: addressed.leadId, orderId: addressed.orderId, extra }
}

/** The catalog key and field of the words that ask for a missing key. */
export const needTextOf = (key: string, subjectType: string): NeedText => {
    if (key === "lead_id") return { key: "office.cmdNeedLead", field: key }
    if (key !== "subject_id") return { key: "office.cmdNeedOther", field: key }
    if (subjectType === "order") return { key: "office.cmdNeedOrder", field: subjectType }
    if (subjectType === "lead") return { key: "office.cmdNeedLead", field: subjectType }
    if (subjectType === "invoice") return { key: "office.cmdNeedInvoice", field: subjectType }
    return { key: "office.cmdNeedOther", field: subjectType }
}

/** The card rows of a ready command: the customer, the order, then every other required key. */
export const cardRowsOf = (
    ready: ReadyResolution,
    refs: MessageRefs,
    leadNames: ReadonlyMap<string, string>,
    labels: CardLabels,
): ReadonlyArray<ShownRow> => {
    const customer: ReadonlyArray<ShownRow> =
        ready.leadId === null
            ? []
            : [{ key: "customer", label: labels.customer, value: leadNames.get(ready.leadId) ?? ready.leadId }]
    const order = refs.orders.find((candidate) => candidate.id === ready.orderId)
    const orderRow: ReadonlyArray<ShownRow> =
        order === undefined
            ? []
            : [
                  {
                      key: "order",
                      label: labels.order,
                      value: order.orderNo.startsWith("#") ? order.orderNo : `#${order.orderNo}`,
                  },
              ]
    const others = Object.entries(ready.extra).map(([key, value]) => ({ key, label: key, value: String(value) }))
    return [...customer, ...orderRow, ...others]
}

/** The row the summary names the command's subject by: the order, else the customer. */
export const subjectRowOf = (rows: ReadonlyArray<ShownRow>): ShownRow | undefined =>
    rows.find((row) => row.key === "order") ?? rows.find((row) => row.key === "customer")

/** The reason a failed send is stored with: the refusal detail of a domain error, else the text of the failure. */
export const failureDetail = (cause: unknown): string => {
    if (cause instanceof DomainError) {
        const detail = cause.params["detail"]
        return typeof detail === "string" ? detail : cause.code
    }
    return cause instanceof Error ? cause.message : String(cause)
}
