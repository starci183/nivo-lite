import type { ConnectionRecord } from "@modules/domain/connections"

/**
 * THE DOMAIN REGISTRAR PORT: the generic purposes a domain registrar account serves (`nivo.tool.domain.*`), implemented by each
 * registrar provider in its OWN folder (`inet-provider`, `tino-provider`, ...). Every provider is equal: the port names purposes, never a
 * provider. A member a provider's public documentation does not state is null (never guessed); what the provider answered beyond the
 * documented members rides as `providerData` (its own words, for a person to read), never read into a decision.
 */

/** A provider answer kept as it came, for a person to read; never read into a decision. */
export interface ProviderData {
    /** Any member. */
    readonly [member: string]: unknown
}

/** Whether a name can be registered now, as the provider answered. */
export interface DomainAvailability {
    /** The name asked, as the provider spelled it back (or as asked when it did not). */
    readonly name: string
    /** True when the provider said it can be registered. */
    readonly available: boolean
    /** The provider's prices per period, when its documentation states them in the answer; empty otherwise. */
    readonly prices: ReadonlyArray<DomainPeriodPrice>
}

/** The provider's price of one period of a name (its currency: VND for the registrars served today). */
export interface DomainPeriodPrice {
    /** The years. */
    readonly years: number
    /** The price of a registration, or null when not stated. */
    readonly register: number | null
    /** The price of a renewal, or null when not stated. */
    readonly renew: number | null
    /** The price of a transfer, or null when not stated. */
    readonly transfer: number | null
}

/** One domain an account holds, in the members the provider's documentation states. */
export interface DomainRecord {
    /** The domain name. */
    readonly name: string
    /** The provider's own id of the domain (path parameter of its per-domain operations). */
    readonly providerId: string
    /** The provider's status word, or null when not stated. */
    readonly status: string | null
    /** The expiry as the provider printed it, or null when not stated. */
    readonly expiresOn: string | null
    /** The nameservers, or null when the answer does not state them. */
    readonly nameservers: ReadonlyArray<string> | null
    /** True / false when the provider states automatic renewal, else null. */
    readonly autoRenew: boolean | null
}

/** A page of the domains an account holds. */
export interface DomainPage {
    /** The domains of the page. */
    readonly domains: ReadonlyArray<DomainRecord>
    /** The page asked (from 1). */
    readonly page: number
    /** The total of pages, or null when not stated. */
    readonly totalPages: number | null
}

/** What a domain list asks. */
export interface DomainListQuery {
    /** The page, from 1. */
    readonly page: number
    /** Rows per page. */
    readonly pageSize: number
}

/** One contact of a registration, for a provider whose registration takes contact data (its documentation names the members). */
export interface DomainContact {
    /** The role of the contact. */
    readonly role: "registrant" | "admin" | "technical" | "billing"
    /** The full name (the organisation's name for an organisation). */
    readonly fullName: string
    /** True for an organisation. */
    readonly organization: boolean
    /** The e-mail address. */
    readonly email: string
    /** The phone number. */
    readonly phone: string
    /** The country code (`VN`). */
    readonly country: string
    /** The province code or the state name. */
    readonly province: string
    /** The street address without the province and the country. */
    readonly address: string
    /** The ward, in full. */
    readonly ward: string
    /** The tax code of an organisation. */
    readonly taxCode?: string
    /** The national id number of a person. */
    readonly idNumber?: string
    /** The gender of a person. */
    readonly gender?: string
    /** The birthday of a person, `dd/MM/yyyy`. */
    readonly birthday?: string
}

/** What a registration asks. */
export interface DomainRegistrationRequest {
    /** The name to register. */
    readonly name: string
    /** The years. */
    readonly years: number
    /** The nameservers to start with; empty = the provider's default. */
    readonly nameservers: ReadonlyArray<string>
    /** The contacts, for a provider whose registration takes contact data; empty otherwise. */
    readonly contacts: ReadonlyArray<DomainContact>
}

/** What a renewal asks. */
export interface DomainRenewalRequest {
    /** The domain the account holds. */
    readonly domain: DomainRecord
    /** The years to add. */
    readonly years: number
}

/** What an incoming transfer asks. */
export interface DomainTransferRequest {
    /** The name to bring to the account. */
    readonly name: string
    /** The transfer code the current registrar issued. */
    readonly authCode: string
    /** The years a provider charges with the transfer, when it takes them. */
    readonly years: number
}

/** What an order-like write (register, renew, transfer) answered. */
export interface DomainOrderReceipt {
    /** The name. */
    readonly name: string
    /** The provider's order or invoice reference, or null when its documentation states none. */
    readonly reference: string | null
    /** The total charged, or null when not stated. */
    readonly total: number | null
    /** What else the provider answered, as it came. */
    readonly providerData: ProviderData | null
}

/** One DNS record, in the members both registrars document. */
export interface DnsRecord {
    /** The provider's id (or index) of the record, or null when the answer states none. */
    readonly id: string | null
    /** The host (`@`, `www`). */
    readonly name: string
    /** The type (`A`, `CNAME`, `MX`, `TXT`, ...). */
    readonly type: string
    /** The value. */
    readonly value: string
    /** The time to live in seconds, or null when not stated. */
    readonly ttl: number | null
    /** The priority (MX), or null. */
    readonly priority: number | null
}

/** A DNS record to write. */
export interface DnsRecordInput {
    /** The host. */
    readonly name: string
    /** The type. */
    readonly type: string
    /** The value. */
    readonly value: string
    /** The time to live in seconds, when the provider takes one. */
    readonly ttl: number | null
    /** The priority (MX), when the provider takes one. */
    readonly priority: number | null
}

/**
 * The DNS records of a domain: `parsed` when the provider's documentation states the members of its answer; `undocumented` when it
 * states none (the answer rides as it came, for a person to read).
 */
export type DnsRecordList =
    | { readonly kind: "parsed"; readonly records: ReadonlyArray<DnsRecord> }
    | { readonly kind: "undocumented"; readonly providerData: ProviderData }

/** What a DNS or nameserver write answered: accepted, with the records after it when the provider's documentation states them. */
export interface DomainChange {
    /** The domain. */
    readonly name: string
    /** The records after the write, when stated; null otherwise. */
    readonly records: ReadonlyArray<DnsRecord> | null
    /** What else the provider answered, as it came, or null. */
    readonly providerData: ProviderData | null
}

/**
 * Why a domain operation is refused at the provider, said by the ADAPTER where it knows it (never read from a message):
 * - `not_available`: the account cannot serve this purpose (its provider's public documentation does not state the operation, or the
 *   account's API context lacks it): the setup, never tried as if it could;
 * - `not_found`: the account holds no such domain;
 * - `already_exists`: the provider answered the resource exists (HTTP 409);
 * - `rejected`: the provider refused the request as asked (HTTP 400 / its business error body); `providerCode` carries its own code;
 * - `contacts_required` / `contacts_unsupported`: the registration's contact data does not fit what this provider takes.
 */
export type DomainRefusalReason =
    | "not_available"
    | "not_found"
    | "already_exists"
    | "rejected"
    | "contacts_required"
    | "contacts_unsupported"

/**
 * Every refusal a generic domain tool answers (`nivo.tool.domain.*`): the providers' reasons (`DomainRefusalReason`) and the tools' own,
 * `domain_not_held` (no registrar account of the workspace holds the domain), `not_connected` (no registrar account the call could
 * use) and `not_selected` (several could take a name not held yet, and none was handed). A leaf list, so the engine's tool registry
 * states it without importing the tools (which import the gateway, which imports the registry).
 */
export const DOMAIN_TOOL_REFUSALS: readonly ["not_available", "not_found", "already_exists", "rejected", "contacts_required", "contacts_unsupported", "domain_not_held", "not_connected", "not_selected"] = [
    "not_available",
    "not_found",
    "already_exists",
    "rejected",
    "contacts_required",
    "contacts_unsupported",
    "domain_not_held",
    "not_connected",
    "not_selected",
] as const satisfies ReadonlyArray<string>

/** One refusal of a generic domain tool. */
export type DomainToolRefusal = (typeof DOMAIN_TOOL_REFUSALS)[number]

/**
 * The refusals of a generic domain tool a node reads and goes on from (class `business` in the tools' `DOMAIN_REFUSAL_CLASS`, a spec
 * holds the two equal): the engine's tool registry lists exactly these; the others (the setup: `not_available`, `not_connected`,
 * `not_selected`) freeze the step.
 */
export const DOMAIN_TOOL_BUSINESS_REFUSALS: readonly ["not_found", "already_exists", "rejected", "contacts_required", "contacts_unsupported", "domain_not_held"] = [
    "not_found",
    "already_exists",
    "rejected",
    "contacts_required",
    "contacts_unsupported",
    "domain_not_held",
] as const satisfies ReadonlyArray<DomainToolRefusal>

/**
 * The domain purposes of one registrar provider, on one connected account. A refusal is a `registrarRefusal` (a `ProviderRegistryError`); a failure of the
 * provider (unreachable, 5xx, rate limit, refused credential) is thrown with its proof attached (`withProof`): `not_sent` when nothing
 * reached the provider's handler (no token, a refusal at its gateway: 401 / 403 / 429), `unknown` when the request left and its effect
 * is not known (a timeout, a broken connection, a 5xx).
 */
export interface DomainRegistrarPort {
    /** The provider key of the accounts it serves. */
    readonly provider: string
    /** Whether a name can be registered now. */
    availability(connection: ConnectionRecord, name: string): Promise<DomainAvailability>
    /** The domain the account holds under this name, or null when it holds none: the OWNER READER of a domain operation (by data). */
    find(connection: ConnectionRecord, name: string): Promise<DomainRecord | null>
    /** A held domain with every member the provider's documentation states (its detail read, when it publishes one). */
    details(connection: ConnectionRecord, domain: DomainRecord): Promise<DomainRecord>
    /** A page of the domains the account holds. */
    list(connection: ConnectionRecord, query: DomainListQuery): Promise<DomainPage>
    /** Registers a new name on the account. */
    register(connection: ConnectionRecord, request: DomainRegistrationRequest): Promise<DomainOrderReceipt>
    /** Renews a domain the account holds. */
    renew(connection: ConnectionRecord, request: DomainRenewalRequest): Promise<DomainOrderReceipt>
    /** Asks a name to be transferred in to the account. */
    transfer(connection: ConnectionRecord, request: DomainTransferRequest): Promise<DomainOrderReceipt>
    /** The DNS records of a domain the account holds. */
    dnsRecords(connection: ConnectionRecord, domain: DomainRecord): Promise<DnsRecordList>
    /** Adds one DNS record. */
    createDnsRecord(connection: ConnectionRecord, domain: DomainRecord, record: DnsRecordInput): Promise<DomainChange>
    /** Replaces one DNS record (by its id). */
    updateDnsRecord(connection: ConnectionRecord, domain: DomainRecord, recordId: string, record: DnsRecordInput): Promise<DomainChange>
    /** Removes one DNS record (by its id). */
    deleteDnsRecord(connection: ConnectionRecord, domain: DomainRecord, recordId: string): Promise<DomainChange>
    /** Replaces the nameservers of a domain. */
    updateNameservers(connection: ConnectionRecord, domain: DomainRecord, nameservers: ReadonlyArray<string>): Promise<DomainChange>
}
