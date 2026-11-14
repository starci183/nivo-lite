import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    registrarRefusal,
    type DnsRecordInput,
    type DnsRecordList,
    type DomainAvailability,
    type DomainChange,
    type DomainListQuery,
    type DomainOrderReceipt,
    type DomainPage,
    type DomainRecord,
    type DomainRegistrarPort,
    type DomainRegistrationRequest,
    type DomainRenewalRequest,
    type DomainTransferRequest,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService, type SandboxState } from "@modules/domain/provider-sandbox"
import { TINO_PROVIDER } from "./tino-connection-fields.policy"
import {
    TINO_CASE,
    TINO_RENEW_OPERATION,
    TINO_SANDBOX_DOMAINS,
    TINO_SANDBOX_NAMESERVERS,
    TINO_SANDBOX_PERIODS,
    TINO_SANDBOX_RENEWAL_PRICE,
    tinoSandboxDomainOf,
    type TinoSandboxDomain,
} from "./tino-sandbox.catalogue"
import { tinoAuthRefused, tinoRejected, tinoServerError, tinoUnreachable } from "./tino-sandbox.failures"

/** State name: the expiry a renewal moved (key = domain name, value = `YYYY-MM-DD`); without it the catalogue's expiry applies. */
const EXPIRY = "expiry"

/** State name: the expiry a renewal accepted but not finished will move to (key = domain name, value = `YYYY-MM-DD`, "" = none). */
const PENDING = "pending-expiry"

/** The record a held domain answers to a DNS read (Tino's answer is undocumented: it rides as it came). */
const DNS_RECORD = { id: 1, name: "@", type: "A", content: "203.0.113.10" } as const

/** A running reference of an order: `SBX-TINO-` and the call's running number (calls of the operation before it, plus one) on six digits. */
const referenceOf = (seq: number): string => `SBX-TINO-${String(seq + 1).padStart(6, "0")}`

/** The date `years` years after an ISO date (`YYYY-MM-DD`), by the year only. */
const addYears = (date: string, years: number): string => `${String(Number(date.slice(0, 4)) + years)}${date.slice(4)}`

/** State name: how many reads of a domain followed a renewal accepted but not finished (key = domain name, an integer; absent = none). */
const PENDING_READS = "pending-reads"

/**
 * The expiry a domain has now: the one a renewal kept, else the catalogue's. A renewal accepted but not finished (the pending case)
 * finishes with the SECOND read of the domain after it (the sandbox's deterministic "later"): the first read, which is the renewal
 * tool's own proof read right after the order, still reports the old expiry, so the order is `pending`; the second read keeps the
 * pending expiry and clears the mark before it answers.
 */
const expiryOf = async (state: SandboxState, domain: TinoSandboxDomain): Promise<string> => {
    const pending = await state.read(PENDING, domain.name)
    if (typeof pending === "string" && pending !== "") {
        const seen = await state.read(PENDING_READS, domain.name)
        const reads = (typeof seen === "number" ? seen : 0) + 1
        if (reads >= 2) {
            await state.write(EXPIRY, domain.name, pending)
            await state.write(PENDING, domain.name, "")
            await state.write(PENDING_READS, domain.name, 0)
        } else {
            await state.write(PENDING_READS, domain.name, reads)
        }
    }
    return await settledExpiryOf(state, domain)
}

/** The expiry a domain holds without any read counting toward a pending renewal: the one a renewal kept, else the catalogue's. */
const settledExpiryOf = async (state: SandboxState, domain: TinoSandboxDomain): Promise<string> => {
    const kept = await state.read(EXPIRY, domain.name)
    return typeof kept === "string" ? kept : domain.expiresOn
}

/** Keeps the expiry a renewal applied and drops any pending renewal of the domain (the applied one is the newest word). */
const settle = async (state: SandboxState, name: string, expiresOn: string): Promise<void> => {
    await state.write(EXPIRY, name, expiresOn)
    await state.write(PENDING, name, "")
    await state.write(PENDING_READS, name, 0)
}

/** The expiry a renewal starts from (not a read: it does not count toward a pending renewal): the one kept, else the catalogue's, else the one the request's record states, else none. */
const renewalBaseOf = async (state: SandboxState, name: string, stated: string | null): Promise<string | null> => {
    const held = tinoSandboxDomainOf(name)
    if (held !== null) return await settledExpiryOf(state, held)
    const kept = await state.read(EXPIRY, name)
    return typeof kept === "string" ? kept : stated
}

@Injectable()
/**
 * Tino's SANDBOX implementation of the domain registrar port (owner rulings R56, R58, R59, R60, R62), used when the provider account is a
 * sandbox account. Every method answers through ONE sandbox call keyed by the domain name; it reaches no host, and the frame logs the call.
 *
 * `renew` is the one operation with cases (`TINO_SANDBOX_CASES`): the account's sticky NEXT CASE (`state.nextCase`) picks the outcome, never
 * the domain name; nothing picked answers `TINO-1`. Success moves the domain's expiry in the account's state by the years (from the state's
 * expiry, else the catalogue's, else the one the request's record states: no clock) and answers a receipt like Tino's renewal answer
 * (`invoice_id` = `SBX-TINO-<n>`, n = calls of `renew` before this one plus one: a refused call also counts; `total` = years x the fixed
 * price). `TINO-3` (pending) answers an accepted order: live Tino publishes no pending answer, so this is the closest truthful shape (the
 * live adapter reads the reference from `invoice_id`, else `order_num`: the pending answer carries only `order_num` and a `pending`
 * status, no invoice, no total, no expiry); it FINISHES with the SECOND read of that domain after it (`find`, `details` or `list`; the renewal's own proof read is the first and still reports the old expiry), which answers
 * the new expiry (no Tino webhook exists on NIVO: the read is how an order is followed). Failing cases throw what the live adapter
 * throws for the same Tino failure (`./tino-sandbox.failures`); `TINO-6` applies the renewal and then times out. `find` and `details`
 * answer the catalogue domain with the state's expiry and `find` answers null for a name the catalogue does not hold (as live); `list`
 * pages the catalogue (Tino states no page total). Other methods answer documented defaults in the live shapes.
 */
export class TinoSandboxRegistrarService implements DomainRegistrarPort {
    /** The provider key. */
    readonly provider: typeof TINO_PROVIDER = TINO_PROVIDER

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Whether a name can be registered: not when the catalogue holds it; Tino's per-period prices are quoted. */
    async availability(connection: ConnectionRecord, name: string): Promise<DomainAvailability> {
        return await this.sandbox.call(
            connection,
            "availability",
            { name },
            { key: name, answer: () => ({ name, available: tinoSandboxDomainOf(name) === null, prices: TINO_SANDBOX_PERIODS }) },
        )
    }

    /** The catalogue domain by this name with the state's expiry; null when the catalogue does not name it. */
    async find(connection: ConnectionRecord, name: string): Promise<DomainRecord | null> {
        return await this.sandbox.call(
            connection,
            "find",
            { name },
            {
                key: name,
                answer: async (state) => {
                    const held = tinoSandboxDomainOf(name)
                    return held === null ? null : await this.recordOf(state, held)
                },
            },
        )
    }

    /** The record of one held domain, as `find` answers it. */
    async details(connection: ConnectionRecord, domain: DomainRecord): Promise<DomainRecord> {
        return await this.sandbox.call(
            connection,
            "details",
            { domain },
            { key: domain.name, answer: async (state) => await this.recordOf(state, this.held(domain.name)) },
        )
    }

    /** A page of the catalogue domains (page from 1). */
    async list(connection: ConnectionRecord, query: DomainListQuery): Promise<DomainPage> {
        return await this.sandbox.call(connection, "list", query, {
            key: String(query.page),
            answer: async (state) => {
                const start = (query.page - 1) * query.pageSize
                const rows = TINO_SANDBOX_DOMAINS.slice(start, start + query.pageSize)
                const domains = await Promise.all(rows.map((row) => this.recordOf(state, row)))
                return { domains, page: query.page, totalPages: null }
            },
        })
    }

    /** Orders a new domain: refused like live with contacts (`contacts_unsupported`) or a name not free; else the bare accepted order. */
    async register(connection: ConnectionRecord, request: DomainRegistrationRequest): Promise<DomainOrderReceipt> {
        return await this.sandbox.call(connection, "register", request, {
            key: request.name,
            answer: () => {
                if (request.contacts.length > 0) throw registrarRefusal("contacts_unsupported")
                if (tinoSandboxDomainOf(request.name) !== null) throw tinoRejected("not free")
                return { name: request.name, reference: null, total: null, providerData: { sandbox: true } }
            },
        })
    }

    /** Renews a domain by the account's next case of `renew` (default `TINO-1`: renewed); see the class. */
    async renew(connection: ConnectionRecord, request: DomainRenewalRequest): Promise<DomainOrderReceipt> {
        return await this.sandbox.call(connection, TINO_RENEW_OPERATION, request, {
            key: request.domain.name,
            answer: async (state) => {
                switch (state.nextCase) {
                    case TINO_CASE.insufficientBalance:
                        throw registrarRefusal("insufficient_balance", "insufficient_balance")
                    case TINO_CASE.locked:
                        throw registrarRefusal("domain_locked", "domain_locked")
                    case TINO_CASE.alreadyRenewed:
                        throw tinoRejected("domain_already_renewed")
                    case TINO_CASE.flaky:
                        throw tinoServerError()
                    case TINO_CASE.unreachable:
                        throw tinoUnreachable()
                    case TINO_CASE.auth:
                        throw tinoAuthRefused()
                    case TINO_CASE.notFound:
                        throw tinoRejected("domain_not_held")
                }
                const name = request.domain.name.trim().toLowerCase()
                const base = await renewalBaseOf(state, name, request.domain.expiresOn)
                const moved = base === null ? null : addYears(base, request.years)
                const reference = referenceOf(state.seq)
                if (state.nextCase === TINO_CASE.appliedTimedOut) {
                    if (moved !== null) await settle(state, name, moved)
                    throw tinoUnreachable()
                }
                if (state.nextCase === TINO_CASE.pending) {
                    if (moved !== null) {
                        await state.write(PENDING, name, moved)
                        await state.write(PENDING_READS, name, 0)
                    }
                    return { name: request.domain.name, reference, total: null, providerData: { order_num: reference, status: "pending" } }
                }
                if (moved !== null) await settle(state, name, moved)
                const total = request.years * TINO_SANDBOX_RENEWAL_PRICE
                return {
                    name: request.domain.name,
                    reference,
                    total,
                    providerData: { invoice_id: reference, total, ...(moved === null ? {} : { expires: moved }) },
                }
            },
        })
    }

    /** Starts the transfer of a name into the account: the bare accepted order (a catalogue name is already held: `rejected`). */
    async transfer(connection: ConnectionRecord, request: DomainTransferRequest): Promise<DomainOrderReceipt> {
        return await this.sandbox.call(connection, "transfer", request, {
            key: request.name,
            answer: () => {
                if (tinoSandboxDomainOf(request.name) !== null) throw tinoRejected("already_in_account")
                return { name: request.name, reference: null, total: null, providerData: { sandbox: true } }
            },
        })
    }

    /** The DNS records of a held domain: Tino's undocumented answer, as it came. */
    async dnsRecords(connection: ConnectionRecord, domain: DomainRecord): Promise<DnsRecordList> {
        return await this.sandbox.call(connection, "dnsRecords", { domain }, {
            key: domain.name,
            answer: (): DnsRecordList => {
                this.held(domain.name)
                return { kind: "undocumented", providerData: { records: [DNS_RECORD] } }
            },
        })
    }

    /** Accepts a DNS record of a held domain (a ttl is refused, as live: Tino's route takes none). */
    async createDnsRecord(connection: ConnectionRecord, domain: DomainRecord, record: DnsRecordInput): Promise<DomainChange> {
        return await this.changed(connection, "createDnsRecord", domain, { domain, record }, record)
    }

    /** Accepts the change of a DNS record of a held domain (a ttl is refused, as live). */
    async updateDnsRecord(
        connection: ConnectionRecord,
        domain: DomainRecord,
        recordId: string,
        record: DnsRecordInput,
    ): Promise<DomainChange> {
        return await this.changed(connection, "updateDnsRecord", domain, { domain, recordId, record }, record)
    }

    /** Accepts the removal of a DNS record of a held domain. */
    async deleteDnsRecord(connection: ConnectionRecord, domain: DomainRecord, recordId: string): Promise<DomainChange> {
        return await this.changed(connection, "deleteDnsRecord", domain, { domain, recordId }, null)
    }

    /** Accepts new nameservers of a held domain. */
    async updateNameservers(
        connection: ConnectionRecord,
        domain: DomainRecord,
        nameservers: ReadonlyArray<string>,
    ): Promise<DomainChange> {
        return await this.changed(connection, "updateNameservers", domain, { domain, nameservers }, null)
    }

    /** One write the sandbox only accepts (it keeps no records): the change of a held domain, refused `rejected` for any other. */
    private async changed(
        connection: ConnectionRecord,
        operation: string,
        domain: DomainRecord,
        request: unknown,
        record: DnsRecordInput | null,
    ): Promise<DomainChange> {
        return await this.sandbox.call(connection, operation, request, {
            key: domain.name,
            answer: () => {
                if (record !== null && record.ttl !== null) throw registrarRefusal("rejected", "ttl not taken")
                this.held(domain.name)
                return { name: domain.name, records: null, providerData: { sandbox: true } }
            },
        })
    }

    /** The catalogue domain of a name, or Tino's business refusal. */
    private held(name: string): TinoSandboxDomain {
        const held = tinoSandboxDomainOf(name)
        if (held === null) throw tinoRejected("domain_not_held")
        return held
    }

    /** A catalogue domain in the port's words with the state's expiry. */
    private async recordOf(state: SandboxState, held: TinoSandboxDomain): Promise<DomainRecord> {
        return {
            name: held.name,
            providerId: held.id,
            status: "Active",
            expiresOn: await expiryOf(state, held),
            nameservers: TINO_SANDBOX_NAMESERVERS,
            autoRenew: false,
        }
    }
}
