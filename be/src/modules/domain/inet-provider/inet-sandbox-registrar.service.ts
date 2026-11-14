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
import { INET_PROVIDER } from "./inet-connection-fields.policy"
import { familyOf } from "./inet-domain-registrar.service"
import {
    INET_CASE,
    INET_RENEW_OPERATION,
    INET_SANDBOX_DOMAINS,
    INET_SANDBOX_NAMESERVERS,
    INET_SANDBOX_RENEWAL_PRICE,
    inetSandboxDomainOf,
    type InetSandboxDomain,
} from "./inet-sandbox.catalogue"
import {
    inetAuthRefused,
    inetConflict,
    inetRateLimited,
        inetServerError,
    inetUnreachable,
} from "./inet-sandbox.failures"

/** State name: the expiry a renewal moved (key = domain name, value = `YYYY-MM-DD`); without it the catalogue's expiry applies. */
const EXPIRY = "expiry"

/** State name: the expiry a renewal accepted but not finished will move to (key = domain name, value = `YYYY-MM-DD`, "" = none). */
const PENDING = "pending-expiry"

/** The prices `availability` quotes (the live portal answer states none). */
const NO_PRICES: DomainAvailability["prices"] = []

/** The record a held domain answers to a DNS read (one fixed `A` record). */
const DNS_RECORD = { id: "1", name: "@", type: "A", value: "203.0.113.10", ttl: 3600, priority: null } as const

/** A running reference of an order: `SBX-INET-` and the call's running number (calls of the operation before it, plus one) on six digits. */
const referenceOf = (seq: number): string => `SBX-INET-${String(seq + 1).padStart(6, "0")}`

/** The date `years` years after an ISO date (`YYYY-MM-DD`), by the year only. */
const addYears = (date: string, years: number): string => `${String(Number(date.slice(0, 4)) + years)}${date.slice(4)}`

/** The receipt of a priced order: reference from the running number, total = years x the fixed price. */
const receiptOf = (name: string, years: number, seq: number, expiresOn: string | null): DomainOrderReceipt => ({
    name,
    reference: referenceOf(seq),
    total: years * INET_SANDBOX_RENEWAL_PRICE,
    providerData: { sandbox: true, period: years, ...(expiresOn === null ? {} : { expiresOn }) },
})

/** State name: how many reads of a domain followed a renewal accepted but not finished (key = domain name, an integer; absent = none). */
const PENDING_READS = "pending-reads"

/**
 * The expiry a domain has now: the one a renewal kept, else the catalogue's. A renewal accepted but not finished (the pending case)
 * finishes with the SECOND read of the domain after it (the sandbox's deterministic "later"): the first read, which is the renewal
 * tool's own proof read right after the order, still reports the old expiry, so the order is `pending`; the second read keeps the
 * pending expiry and clears the mark before it answers.
 */
const expiryOf = async (state: SandboxState, domain: InetSandboxDomain): Promise<string> => {
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
const settledExpiryOf = async (state: SandboxState, domain: InetSandboxDomain): Promise<string> => {
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
    const held = inetSandboxDomainOf(name)
    if (held !== null) return await settledExpiryOf(state, held)
    const kept = await state.read(EXPIRY, name)
    return typeof kept === "string" ? kept : stated
}

@Injectable()
/**
 * iNET's SANDBOX implementation of the domain registrar port (owner rulings R56, R58, R59, R60, R62), used when the provider account is
 * a sandbox account. Every method answers through ONE sandbox call keyed by the domain name; it reaches no host, and the frame logs the call.
 *
 * `renew` is the one operation with cases (`INET_SANDBOX_CASES`): the account's sticky NEXT CASE (`state.nextCase`) picks the outcome, never
 * the domain name; nothing picked answers `INET-1`. A portal-family account (api_context not reseller) is refused `not_available` whatever
 * the case, as live. Success (`INET-1`) moves the domain's expiry in the account's state by the years (from the state's expiry, else the
 * catalogue's, else the one the request's record states: no clock) and answers a receipt `SBX-INET-<n>` (n = calls of `renew` before this
 * one, plus one: a refused call also counts), total = years x the fixed price. `INET-3` (pending) answers the same receipt with status
 * `pending` and no new expiry: live iNET publishes no pending answer, so this is the closest truthful shape (an accepted order, not
 * finished); it FINISHES with the next read of that domain (`find`, `details` or `list`), which answers the new expiry (no iNET webhook
 * exists on NIVO: the read is how a registrar order is followed). Failing cases throw what the live adapter throws for the same iNET
 * failure (`./inet-sandbox.failures`); `INET-6` applies the renewal and then times out. `find` and `details` answer the catalogue domain
 * with the state's expiry in full (live answers an expiry only for portal accounts: the sandbox always states it, because a renewal is
 * proven by it) and `find` answers null for a name the catalogue does not hold; `list` pages the catalogue. Other methods answer
 * documented defaults in the live shapes; the registration of a name the catalogue holds is refused `already_exists`.
 */
export class InetSandboxRegistrarService implements DomainRegistrarPort {
    /** The provider key. */
    readonly provider: typeof INET_PROVIDER = INET_PROVIDER

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Whether a name can be registered: not when the catalogue holds it. */
    async availability(connection: ConnectionRecord, name: string): Promise<DomainAvailability> {
        return await this.sandbox.call(
            connection,
            "availability",
            { name },
            { key: name, answer: () => ({ name, available: inetSandboxDomainOf(name) === null, prices: NO_PRICES }) },
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
                    const held = inetSandboxDomainOf(name)
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
                const rows = INET_SANDBOX_DOMAINS.slice(start, start + query.pageSize)
                const domains = await Promise.all(rows.map((row) => this.recordOf(state, row)))
                return { domains, page: query.page, totalPages: Math.ceil(INET_SANDBOX_DOMAINS.length / query.pageSize) }
            },
        })
    }

    /** Registers a new domain: refused like live without contacts or nameservers, `already_exists` for a catalogue name; else a receipt. */
    async register(connection: ConnectionRecord, request: DomainRegistrationRequest): Promise<DomainOrderReceipt> {
        return await this.sandbox.call(connection, "register", request, {
            key: request.name,
            answer: (state) => {
                if (familyOf(connection) !== "reseller") throw registrarRefusal("not_available", "portal registration undocumented")
                if (request.contacts.length === 0) throw registrarRefusal("contacts_required")
                if (request.nameservers.length === 0) throw registrarRefusal("rejected", "nsList required")
                if (inetSandboxDomainOf(request.name) !== null) throw inetConflict()
                return receiptOf(request.name, request.years, state.seq, null)
            },
        })
    }

    /** Renews a domain by the account's next case of `renew` (default `INET-1`: renewed); see the class. */
    async renew(connection: ConnectionRecord, request: DomainRenewalRequest): Promise<DomainOrderReceipt> {
        return await this.sandbox.call(connection, INET_RENEW_OPERATION, request, {
            key: request.domain.name,
            answer: async (state) => {
                if (familyOf(connection) !== "reseller" || state.nextCase === INET_CASE.portal) {
                    throw registrarRefusal("not_available", "portal renewal undocumented")
                }
                const name = request.domain.name.trim().toLowerCase()
                switch (state.nextCase) {
                    case INET_CASE.insufficientBalance:
                        throw registrarRefusal("insufficient_balance", "insufficient_balance")
                    case INET_CASE.locked:
                        throw registrarRefusal("domain_locked", "domain_locked")
                    case INET_CASE.alreadyRenewed:
                        throw inetConflict()
                    case INET_CASE.flaky:
                        throw inetServerError()
                    case INET_CASE.unreachable:
                        throw inetUnreachable()
                    case INET_CASE.auth:
                        throw inetAuthRefused()
                    case INET_CASE.rate:
                        throw inetRateLimited()
                    case INET_CASE.notFound:
                        throw registrarRefusal("not_found", "domain")
                }
                const base = await renewalBaseOf(state, name, request.domain.expiresOn)
                const moved = base === null ? null : addYears(base, request.years)
                if (state.nextCase === INET_CASE.appliedTimedOut) {
                    if (moved !== null) await settle(state, name, moved)
                    throw inetUnreachable()
                }
                if (state.nextCase === INET_CASE.pending) {
                    if (moved !== null) {
                        await state.write(PENDING, name, moved)
                        await state.write(PENDING_READS, name, 0)
                    }
                    return { ...receiptOf(request.domain.name, request.years, state.seq, null), providerData: { sandbox: true, period: request.years, status: "pending" } }
                }
                if (moved !== null) await settle(state, name, moved)
                return receiptOf(request.domain.name, request.years, state.seq, moved)
            },
        })
    }

    /** Starts the transfer of a name into the account: a receipt (a catalogue name is already held: `already_exists`). */
    async transfer(connection: ConnectionRecord, request: DomainTransferRequest): Promise<DomainOrderReceipt> {
        return await this.sandbox.call(connection, "transfer", request, {
            key: request.name,
            answer: (state) => {
                if (familyOf(connection) !== "reseller") throw registrarRefusal("not_available", "portal transfer undocumented")
                if (inetSandboxDomainOf(request.name) !== null) throw inetConflict()
                return receiptOf(request.name, request.years, state.seq, null)
            },
        })
    }

    /** The DNS records of a held domain: parsed for a portal account, the undocumented answer for a reseller one (as live). */
    async dnsRecords(connection: ConnectionRecord, domain: DomainRecord): Promise<DnsRecordList> {
        return await this.sandbox.call(connection, "dnsRecords", { domain }, {
            key: domain.name,
            answer: (): DnsRecordList => {
                this.held(domain.name)
                return familyOf(connection) === "reseller"
                    ? { kind: "undocumented", providerData: { records: [DNS_RECORD] } }
                    : { kind: "parsed", records: [DNS_RECORD] }
            },
        })
    }

    /** Accepts a DNS record of a held domain. */
    async createDnsRecord(connection: ConnectionRecord, domain: DomainRecord, record: DnsRecordInput): Promise<DomainChange> {
        return await this.changed(connection, "createDnsRecord", domain, { domain, record })
    }

    /** Accepts the change of a DNS record of a held domain. */
    async updateDnsRecord(
        connection: ConnectionRecord,
        domain: DomainRecord,
        recordId: string,
        record: DnsRecordInput,
    ): Promise<DomainChange> {
        return await this.changed(connection, "updateDnsRecord", domain, { domain, recordId, record })
    }

    /** Accepts the removal of a DNS record of a held domain. */
    async deleteDnsRecord(connection: ConnectionRecord, domain: DomainRecord, recordId: string): Promise<DomainChange> {
        return await this.changed(connection, "deleteDnsRecord", domain, { domain, recordId })
    }

    /** Accepts new nameservers of a held domain. */
    async updateNameservers(
        connection: ConnectionRecord,
        domain: DomainRecord,
        nameservers: ReadonlyArray<string>,
    ): Promise<DomainChange> {
        return await this.changed(connection, "updateNameservers", domain, { domain, nameservers })
    }

    /** One write the sandbox only accepts (it keeps no records): the change of a held domain, `not_found` for any other. */
    private async changed(connection: ConnectionRecord, operation: string, domain: DomainRecord, request: unknown): Promise<DomainChange> {
        return await this.sandbox.call(connection, operation, request, {
            key: domain.name,
            answer: () => {
                this.held(domain.name)
                return { name: domain.name, records: null, providerData: { sandbox: true } }
            },
        })
    }

    /** The catalogue domain of a name, or the refusal `not_found`. */
    private held(name: string): InetSandboxDomain {
        const held = inetSandboxDomainOf(name)
        if (held === null) throw registrarRefusal("not_found", "domain")
        return held
    }

    /** A catalogue domain in the port's words with the state's expiry. */
    private async recordOf(state: SandboxState, held: InetSandboxDomain): Promise<DomainRecord> {
        return {
            name: held.name,
            providerId: held.id,
            status: "active",
            expiresOn: await expiryOf(state, held),
            nameservers: INET_SANDBOX_NAMESERVERS,
            autoRenew: null,
        }
    }
}
