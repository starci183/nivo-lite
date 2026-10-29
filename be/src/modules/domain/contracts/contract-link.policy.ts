import { contactParts } from "@modules/domain/leads"
import type { LinkedCustomers, UnmatchedContract, UnmatchedReason } from "./contracts.contracts"

/** One customer record of the data hub (entity customer) with the name of the source it came from. */
export interface CustomerRecordRead {
    /** The id of the record in its source. */
    readonly externalId: string
    /** The display title of the record. */
    readonly title: string
    /** The columns of the record, keyed by their header. */
    readonly data: Readonly<Record<string, unknown>>
    /** The name of the data-hub connection the record was synced from, or null. */
    readonly source: string | null
}

/** One contract as the customer link reads it, with the phone and the email of the lead it links to. */
export interface ContractLinkRead {
    /** The contract row id. */
    readonly id: string
    /** The lead the contract links to; null when it has none. */
    readonly leadId: string | null
    /** The customer the contract is signed with. */
    readonly customerName: string
    /** The plan or package the customer bought. */
    readonly plan: string
    /** Free-text remarks; the first segment is the contract reference. */
    readonly note: string
    /** The phone of the linked lead, or null. */
    readonly leadPhone: string | null
    /** The email of the linked lead, or null. */
    readonly leadEmail: string | null
}

/** One customer of the data hub as the link reads it; the phone is `84` digits and the email lowercased, each null when absent. */
export interface CustomerRecord {
    /** The customer name. */
    readonly name: string
    /** The customer code (the "ma khach hang" column), or the record id in its source. */
    readonly code: string
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
    /** True when the record says the customer is a company. */
    readonly company: boolean
    /** The name of the source the record came from; empty when unknown. */
    readonly source: string
}

/** The customer records of a workspace by their name key and by their code key. */
export interface CustomerIndex {
    /** The records under each name key. */
    readonly byName: ReadonlyMap<string, ReadonlyArray<CustomerRecord>>
    /** The records under each code key. */
    readonly byCode: ReadonlyMap<string, ReadonlyArray<CustomerRecord>>
}

/** What a contract is matched to a customer by. */
export interface ContractCustomer {
    /** The customer name the contract carries. */
    readonly customerName: string
    /** The contract note; its first segment is the contract reference. */
    readonly note: string
}

/** The customer a contract belongs to, or why there is none to reach. */
export type CustomerMatch =
    | { readonly kind: "matched"; readonly customer: CustomerRecord }
    | { readonly kind: "unmatched"; readonly reason: UnmatchedReason }

/** A lead the link may tie a contract to: its contact and whether a customer conversation already reaches it. */
export interface LinkLead {
    /** The lead id. */
    readonly id: string
    /** The phone, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
    /** True when the lead has a customer conversation, so a renewal message can leave. */
    readonly reachable: boolean
}

/** What the link does with one matched contract. */
export type LinkPlan =
    | { readonly kind: "keep" }
    | { readonly kind: "fill"; readonly leadId: string }
    | { readonly kind: "move"; readonly leadId: string }
    | { readonly kind: "create" }

const NAME_KEYS = ["ten khach hang", "ho va ten", "ho ten", "customer name", "ten", "name"]
const CODE_KEYS = ["ma khach hang", "ma kh", "customer code", "code"]
const PHONE_KEYS = ["sdt", "so dien thoai", "dien thoai", "phone", "mobile"]
const EMAIL_KEYS = ["email", "e mail"]
const KIND_KEYS = ["khach hang", "loai khach hang", "loai"]
const COMPANY_KIND = "cong ty"
const SEPARATORS = /[,;/|]/
const ASIDE_START = "("
/** The middle dot the contract import writes between the segments of a note. */
const NOTE_SEPARATOR = "·"
const KEEP: LinkPlan = { kind: "keep" }

/** The comparable form of a name or a code: accents and case dropped, the Vietnamese d with a stroke read as `d`, every run of other signs one space. */
export const nameKeyOf = (text: string): string =>
    text
        .replaceAll(/[\u0111\u0110]/g, "d")
        .normalize("NFD")
        .replaceAll(/\p{M}/gu, "")
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, " ")
        .trim()

const textOf = (value: unknown): string => {
    if (typeof value === "string") return value.trim()
    return typeof value === "number" ? String(value) : ""
}

const fieldOf = (data: Readonly<Record<string, unknown>>, keys: ReadonlyArray<string>): string => {
    const columns = Object.entries(data).map(([header, value]) => ({ key: nameKeyOf(header), value: textOf(value) }))
    const found = keys.map((key) => columns.find((column) => column.key === key && column.value !== ""))
    return found.find((column) => column !== undefined)?.value ?? ""
}

const firstOf = (raw: string): string =>
    raw
        .split(SEPARATORS)
        .map((part) => part.trim())
        .find((part) => part !== "") ?? ""

/** Reads one data-hub record as a customer: the name, the code, the first phone and the first email it holds. */
export const customerRecordOf = (row: CustomerRecordRead): CustomerRecord => ({
    name: fieldOf(row.data, NAME_KEYS) || row.title,
    code: fieldOf(row.data, CODE_KEYS) || row.externalId,
    phone: contactParts(firstOf(fieldOf(row.data, PHONE_KEYS))).phone,
    email: contactParts(firstOf(fieldOf(row.data, EMAIL_KEYS))).email,
    company: nameKeyOf(fieldOf(row.data, KIND_KEYS)).startsWith(COMPANY_KIND),
    source: row.source ?? "",
})

const groupedBy = (
    records: ReadonlyArray<CustomerRecord>,
    keyOf: (record: CustomerRecord) => string,
): ReadonlyMap<string, ReadonlyArray<CustomerRecord>> =>
    records.reduce((groups, record) => {
        const key = keyOf(record)
        if (key !== "") groups.set(key, [...(groups.get(key) ?? []), record])
        return groups
    }, new Map<string, Array<CustomerRecord>>())

/** Indexes the customer records by name key and by code key. */
export const indexCustomers = (records: ReadonlyArray<CustomerRecord>): CustomerIndex => ({
    byName: groupedBy(records, (record) => nameKeyOf(record.name)),
    byCode: groupedBy(records, (record) => nameKeyOf(record.code)),
})

const candidatesOf = (contract: ContractCustomer, index: CustomerIndex): ReadonlyArray<CustomerRecord> => {
    const reference = contract.note.split(NOTE_SEPARATOR)[0] ?? ""
    const found = [
        index.byCode.get(nameKeyOf(contract.customerName)),
        index.byCode.get(nameKeyOf(reference)),
        index.byName.get(nameKeyOf(contract.customerName)),
        index.byName.get(nameKeyOf(contract.customerName.split(ASIDE_START)[0] ?? "")),
    ]
    return found.find((records) => records !== undefined) ?? []
}

const contactKeyOf = (record: CustomerRecord): string => `${record.phone ?? ""}|${record.email ?? ""}`

/**
 * Finds the customer of a contract: its name or its contract reference read as a customer code first, then its name, then its
 * name without the part in brackets; accents and case never matter. Records without a phone or an email cannot reach anyone, and
 * records of the same name with different contacts are not guessed between.
 */
export const matchCustomer = (contract: ContractCustomer, index: CustomerIndex): CustomerMatch => {
    const candidates = candidatesOf(contract, index)
    if (candidates.length === 0) return { kind: "unmatched", reason: "noCustomer" }
    const reachable = candidates.filter((record) => record.phone !== null || record.email !== null)
    const [customer] = reachable
    if (customer === undefined) return { kind: "unmatched", reason: "noContact" }
    if (new Set(reachable.map(contactKeyOf)).size > 1) return { kind: "unmatched", reason: "ambiguous" }
    return { kind: "matched", customer }
}

const holds = (lead: LinkLead, customer: CustomerRecord): boolean =>
    (customer.phone !== null && lead.phone === customer.phone) ||
    (customer.email !== null && lead.email === customer.email)

const lacksContact = (lead: LinkLead, customer: CustomerRecord): boolean =>
    (lead.phone === null && customer.phone !== null) || (lead.email === null && customer.email !== null)

const keepOrFill = (lead: LinkLead, customer: CustomerRecord): LinkPlan =>
    lacksContact(lead, customer) ? { kind: "fill", leadId: lead.id } : KEEP

/**
 * Decides which lead a matched contract belongs to, preferring one lead per customer: a contract tied on purpose to a lead with
 * another contact keeps it; the lead a customer conversation already reaches wins, so the renewal finds that conversation; a lead
 * that already holds the phone or the email comes next; the contract's own lead without a contact gains the customer's; only a
 * customer no lead holds gets a new lead.
 */
export const planLink = (
    current: LinkLead | null,
    candidates: ReadonlyArray<LinkLead>,
    customer: CustomerRecord,
): LinkPlan => {
    const others = candidates.filter((lead) => lead.id !== current?.id)
    const reachable = others.find((lead) => lead.reachable)
    if (current !== null) {
        const known = current.phone !== null || current.email !== null
        if (known && !holds(current, customer)) return KEEP
        if (current.reachable) return keepOrFill(current, customer)
        if (reachable === undefined && (known || others.length === 0)) return keepOrFill(current, customer)
    }
    const target = reachable ?? others[0]
    return target === undefined ? { kind: "create" } : { kind: "move", leadId: target.id }
}

/** What linking one contract came to. */
export type LinkStep =
    | { readonly kind: "kept" }
    | { readonly kind: "linked" }
    | { readonly kind: "created" }
    | { readonly kind: "unmatched"; readonly contract: UnmatchedContract }

/** Sums the steps of a run: a created lead links its contract too. */
export const linkedCustomersOf = (steps: ReadonlyArray<LinkStep>): LinkedCustomers => ({
    linked: steps.filter((step) => step.kind === "linked" || step.kind === "created").length,
    created: steps.filter((step) => step.kind === "created").length,
    unmatched: steps.flatMap((step) => (step.kind === "unmatched" ? [step.contract] : [])),
})
