import { Injectable } from "@nestjs/common"
import { ConnectionApiTokenService } from "@modules/domain/connection-secrets"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    registrarRefusal,
    registrarRefusalReason,
    withProof,
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
import {
    InjectTino,
    TINO_OPS,
    TinoError,
    TinoErrorCode,
    tinoDomainDetailOf,
    tinoDomainsOf,
    tinoLookupOf,
    tinoRenewalOf,
    type TinoCall,
    type TinoClient,
    type TinoData,
    type TinoDomain,
    type TinoLookup,
    type TinoOperation,
} from "@modules/integrations/tino"
import { TINO_PROVIDER } from "./tino-connection-fields.policy"
import { DomainError } from "@modules/platform/errors"

/** Two domain names are one name whatever their letter case (DNS names are case-insensitive). */
const sameName = (left: string, right: string): boolean => left.trim().toLowerCase() === right.trim().toLowerCase()

/** A Tino domain in the port's words. */
const recordOf = (domain: TinoDomain): DomainRecord => ({
    name: domain.name,
    providerId: domain.id,
    status: domain.status,
    expiresOn: domain.expires,
    nameservers: domain.nameservers,
    autoRenew: domain.autoRenew,
})

/** A body kept as it came. */
const asIs = (body: TinoData): TinoData => body

/**
 * What a failure of the Tino client proves, attached where it is caught: the route's business refusal (its `error` body) is an ANSWER
 * (`registrarRefusal("rejected", <Tino's code>)`); the gateway refusing the token (401 / 403) proves `not_sent` (no route ran); an
 * unreachable API, a 5xx or an unreadable answer proves nothing (`unknown`).
 */
export const tinoFailureOf = (cause: unknown): unknown => {
    if (registrarRefusalReason(cause) !== null) return cause
    if (!(cause instanceof TinoError)) return withProof(cause, "unknown")
    const reason = typeof cause.params.reason === "string" ? cause.params.reason : null
    switch (cause.code) {
        case TinoErrorCode.Rejected:
            return registrarRefusal("rejected", reason, cause)
        case TinoErrorCode.AuthFailed:
            return withProof(cause, "not_sent")
        case TinoErrorCode.Unreachable:
        case TinoErrorCode.Failed:
            return withProof(cause, "unknown")
    }
}

/** A DNS write member Tino's route does not document (a ttl) is refused, never sent. */
const dnsBodyOf = (record: DnsRecordInput): TinoData => {
    if (record.ttl !== null) throw registrarRefusal("rejected", "ttl not taken")
    return {
        name: record.name,
        type: record.type,
        ...(record.priority === null ? {} : { priority: String(record.priority) }),
        content: record.value,
    }
}

@Injectable()
/**
 * Tino's adapter of the generic domain purposes (`DomainRegistrarPort`), on one connected account: its personal API token is the
 * connection's sealed API token. Orders (register, transfer) and renewals are paid by the account's own method (no `pay_method` is
 * sent: the account's default). Every operation and its documentation: `TINO_OPS`.
 */
export class TinoDomainRegistrarService implements DomainRegistrarPort {
    readonly provider: typeof TINO_PROVIDER = TINO_PROVIDER

    constructor(
        @InjectTino() private readonly tino: TinoClient,
        private readonly tokens: ConnectionApiTokenService,
    ) {}

    /** Asks the registrar whether a domain name can be registered. */
    async availability(connection: ConnectionRecord, name: string): Promise<DomainAvailability> {
        const lookup = await this.lookup(connection, name)
        return { name: lookup.name, available: lookup.available, prices: lookup.periods }
    }

    /**
     * The domain the account holds by this name (`get_domain_name_name`); the route's business refusal (its `error` body: the account
     * has no such domain) is "not held".
     */
    async find(connection: ConnectionRecord, name: string): Promise<DomainRecord | null> {
        try {
            const domains = await this.run(connection, TINO_OPS.domainByName, { path: { name } }, tinoDomainsOf)
            const held = domains.find((domain) => sameName(domain.name, name))
            return held === undefined ? null : recordOf(held)
        } catch (cause) {
            if (registrarRefusalReason(cause) === "rejected") return null
            throw cause
        }
    }

    /** Reads the registrar's record of one held domain. */
    async details(connection: ConnectionRecord, domain: DomainRecord): Promise<DomainRecord> {
        return recordOf(await this.run(connection, TINO_OPS.domainGet, { path: { id: domain.providerId } }, tinoDomainDetailOf))
    }

    /** Lists a page of the domains the account holds. */
    async list(connection: ConnectionRecord, query: DomainListQuery): Promise<DomainPage> {
        // Tino's `page` is 0-based; the port's is 1-based.
        const call = { query: { page: String(query.page - 1), perpage: String(query.pageSize) } }
        const domains = await this.run(connection, TINO_OPS.domainList, call, tinoDomainsOf)
        return { domains: domains.map((domain) => recordOf(domain)), page: query.page, totalPages: null }
    }

    /** Looks the name up first (the route page asks it: an order of a name not free may be cancelled), then orders it. */
    async register(connection: ConnectionRecord, request: DomainRegistrationRequest): Promise<DomainOrderReceipt> {
        // Tino's order takes saved contact ids (`registrant`, `admin`, `tech`, `billing`), never contact data: the account's own apply.
        if (request.contacts.length > 0) throw registrarRefusal("contacts_unsupported")
        const lookup = await this.lookup(connection, request.name)
        if (!lookup.available) throw registrarRefusal("rejected", "not free")
        return this.order(connection, request.name, {
            name: request.name,
            years: String(request.years),
            action: "register",
            ...(lookup.tldId === null ? {} : { tld_id: lookup.tldId }),
            ...(request.nameservers.length === 0 ? {} : { nameservers: request.nameservers }),
        })
    }

    /** Renews a held domain. */
    async renew(connection: ConnectionRecord, request: DomainRenewalRequest): Promise<DomainOrderReceipt> {
        const call = { path: { id: request.domain.providerId }, body: { years: String(request.years) } }
        const body = await this.run(connection, TINO_OPS.domainRenew, call, asIs)
        const renewal = tinoRenewalOf(body)
        return { name: request.domain.name, reference: renewal.reference, total: renewal.total, providerData: body }
    }

    /** Starts the transfer of a domain into the account. */
    async transfer(connection: ConnectionRecord, request: DomainTransferRequest): Promise<DomainOrderReceipt> {
        const lookup = await this.lookup(connection, request.name)
        return this.order(connection, request.name, {
            name: request.name,
            years: String(request.years),
            action: "transfer",
            ...(lookup.tldId === null ? {} : { tld_id: lookup.tldId }),
            epp: request.authCode,
        })
    }

    /** Lists the DNS records of a held domain. */
    async dnsRecords(connection: ConnectionRecord, domain: DomainRecord): Promise<DnsRecordList> {
        // `get_domain_id_dns` publishes no example answer: its records ride as they came.
        const body = await this.run(connection, TINO_OPS.dnsList, { path: { id: domain.providerId } }, asIs)
        return { kind: "undocumented", providerData: body }
    }

    /** Adds a DNS record to a held domain. */
    async createDnsRecord(connection: ConnectionRecord, domain: DomainRecord, record: DnsRecordInput): Promise<DomainChange> {
        const call = { path: { id: domain.providerId }, body: dnsBodyOf(record) }
        return this.changed(domain, await this.run(connection, TINO_OPS.dnsCreate, call, asIs))
    }

    /** Changes a DNS record of a held domain. */
    async updateDnsRecord(
        connection: ConnectionRecord,
        domain: DomainRecord,
        recordId: string,
        record: DnsRecordInput,
    ): Promise<DomainChange> {
        const call = {
            path: { id: domain.providerId, index: recordId },
            body: { record_id: Number(recordId), ...dnsBodyOf(record) },
        }
        return this.changed(domain, await this.run(connection, TINO_OPS.dnsUpdate, call, asIs))
    }

    /** Removes a DNS record of a held domain. */
    async deleteDnsRecord(connection: ConnectionRecord, domain: DomainRecord, recordId: string): Promise<DomainChange> {
        const call = { path: { id: domain.providerId, index: recordId }, query: { record_id: recordId } }
        return this.changed(domain, await this.run(connection, TINO_OPS.dnsDelete, call, asIs))
    }

    /** Replaces the name servers of a held domain. */
    async updateNameservers(
        connection: ConnectionRecord,
        domain: DomainRecord,
        nameservers: ReadonlyArray<string>,
    ): Promise<DomainChange> {
        const call = { path: { id: domain.providerId }, body: { nameservers } }
        return this.changed(domain, await this.run(connection, TINO_OPS.nameserverUpdate, call, asIs))
    }

    private lookup(connection: ConnectionRecord, name: string): Promise<TinoLookup> {
        return this.run(connection, TINO_OPS.domainLookup, { body: { name } }, (body) => tinoLookupOf(body, name))
    }

    private async order(connection: ConnectionRecord, name: string, body: TinoData): Promise<DomainOrderReceipt> {
        // `post_domain_order` publishes no example answer: nothing is read from it but that it is no refusal.
        const answer = await this.run(connection, TINO_OPS.domainOrder, { body }, asIs)
        return { name, reference: null, total: null, providerData: answer }
    }

    private changed(domain: DomainRecord, body: TinoData): DomainChange {
        return { name: domain.name, records: null, providerData: body }
    }

    /**
     * Runs one operation with the account's token and reads its answer; no token is the refusal `not_available` (nothing was sent). A
     * failure of the call or of the read is typed where it is caught (`tinoFailureOf`).
     */
    private async run<T>(
        connection: ConnectionRecord,
        operation: TinoOperation,
        call: TinoCall,
        read: (body: TinoData) => T,
    ): Promise<T> {
        const token = await this.tokens.read(connection.id)
        if (token === null) throw registrarRefusal("not_available", "no api token")
        try {
            return read(await this.tino.call(token, operation, call))
        } catch (cause) {
            const failure = tinoFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
