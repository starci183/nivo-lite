import { Injectable } from "@nestjs/common"
import { ConnectionApiTokenService } from "@modules/domain/connection-secrets"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    registrarRefusal,
    registrarRefusalReason,
    withProof,
    type DnsRecord,
    type DnsRecordInput,
    type DnsRecordList,
    type DomainAvailability,
    type DomainChange,
    type DomainContact,
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
    INET_OPS,
    InetError,
    InetErrorCode,
    InjectInet,
    inetDataAsIs,
    portalAvailabilityOf,
    portalDomainDetailOf,
    portalDomainPageOf,
    portalRecordsOf,
    resellerDomainRefsOf,
    type InetCall,
    type InetClient,
    type InetData,
    type InetFamily,
    type InetOperation,
    type InetPortalDomain,
    type InetPortalRecord,
} from "@modules/integrations/inet"
import { INET_META, INET_PROVIDER } from "./inet-connection-fields.policy"
import { DomainError } from "@modules/platform/errors"

/** The rows one owner lookup reads (the list filtered by the exact name: one row is expected). */
const LOOKUP_PAGE_SIZE = 20

/** The role words iNET's registration takes for each generic contact role (`contacts[].type`, POST /reseller/domains). */
const CONTACT_TYPE: Readonly<Record<DomainContact["role"], string>> = {
    registrant: "registrant",
    admin: "admin",
    technical: "technique",
    billing: "billing",
}

/** Two domain names are one name whatever their letter case (DNS names are case-insensitive). */
const sameName = (left: string, right: string): boolean => left.trim().toLowerCase() === right.trim().toLowerCase()

/** The key context of an account: what its owner declared when connecting it (`api_context`), `portal` when not declared. */
export const familyOf = (connection: ConnectionRecord): InetFamily =>
    connection.meta[INET_META.apiContext] === "reseller" ? "reseller" : "portal"

/** The refusal of a purpose this account's key context cannot serve (iNET documents it for the other context, or not at all). */
const notAvailable = (why: string): never => {
    throw registrarRefusal("not_available", why)
}

/** A Portal domain in the port's words. */
const recordOfPortal = (domain: InetPortalDomain): DomainRecord => ({
    name: domain.name,
    providerId: domain.id,
    status: domain.status,
    expiresOn: domain.expireDate,
    nameservers: domain.nameservers,
    autoRenew: null,
})

/** A Portal record in the port's words. */
const recordOfDns = (record: InetPortalRecord): DnsRecord => ({
    id: record.id,
    name: record.name,
    type: record.type,
    value: record.data,
    ttl: record.ttl,
    priority: record.priority,
})

/** The `nsList` iNET takes. */
const nsListOf = (nameservers: ReadonlyArray<string>): ReadonlyArray<{ readonly hostname: string }> =>
    nameservers.map((hostname) => ({ hostname }))

/** One contact as iNET's registration takes it (only the members the caller gave; none invented). */
const contactOf = (contact: DomainContact): InetData => ({
    type: CONTACT_TYPE[contact.role],
    fullname: contact.fullName,
    organization: contact.organization,
    email: contact.email,
    phone: contact.phone,
    country: contact.country,
    province: contact.province,
    address: contact.address,
    ward: contact.ward,
    ...(contact.taxCode === undefined ? {} : { taxCode: contact.taxCode }),
    ...(contact.idNumber === undefined ? {} : { idNumber: contact.idNumber }),
    ...(contact.gender === undefined ? {} : { gender: contact.gender }),
    ...(contact.birthday === undefined ? {} : { birthday: contact.birthday }),
})

/**
 * What a failure of the iNET client proves, attached where it is caught: a refusal of the request as asked (400, `success: false`) or
 * of a resource that exists (409) is an ANSWER (`registrarRefusal` (a `ProviderRegistryError`)); a refusal at iNET's gateway before any handler ran (401 /
 * 403 the key, 404 no such API, 429 slow down) proves `not_sent`; an unreachable API or a 5xx proves nothing (`unknown`).
 */
export const inetFailureOf = (cause: unknown): unknown => {
    if (registrarRefusalReason(cause) !== null) return cause
    if (!(cause instanceof InetError)) return withProof(cause, "unknown")
    const reason = typeof cause.params.reason === "string" ? cause.params.reason : null
    switch (cause.code) {
        case InetErrorCode.Rejected:
            return registrarRefusal("rejected", reason, cause)
        case InetErrorCode.Conflict:
            return registrarRefusal("already_exists", reason, cause)
        case InetErrorCode.AuthFailed:
        case InetErrorCode.RateLimited:
        case InetErrorCode.NotServed:
            return withProof(cause, "not_sent")
        case InetErrorCode.Unreachable:
        case InetErrorCode.Failed:
            return withProof(cause, "unknown")
    }
}

@Injectable()
/**
 * iNET's adapter of the generic domain purposes (`DomainRegistrarPort`), on one connected account: its API key is the connection's
 * sealed API token, its key context (`portal` or `reseller`) and its reseller customer id are public facts of the connection. A
 * purpose iNET documents only for the other key context, or whose answer it does not publish, is refused `not_available`; nothing is
 * guessed. Every operation and its documentation: `INET_OPS`.
 */
export class InetDomainRegistrarService implements DomainRegistrarPort {
    readonly provider: typeof INET_PROVIDER = INET_PROVIDER

    constructor(
        @InjectInet() private readonly inet: InetClient,
        private readonly tokens: ConnectionApiTokenService,
    ) {}

    /** Asks the registrar whether a domain name can be registered. */
    async availability(connection: ConnectionRecord, name: string): Promise<DomainAvailability> {
        if (familyOf(connection) === "reseller") return notAvailable("reseller availability answer unpublished")
        const answer = await this.run(connection, INET_OPS.portalAvailability, { query: { name } }, (data) =>
            portalAvailabilityOf(data, name),
        )
        return { name: answer.name, available: answer.available, prices: [] }
    }

    /** Finds a domain among those the account holds; null when it does not hold it. */
    async find(connection: ConnectionRecord, name: string): Promise<DomainRecord | null> {
        const query = { name, page: "1", pageSize: String(LOOKUP_PAGE_SIZE) }
        if (familyOf(connection) === "reseller") {
            const refs = await this.run(connection, INET_OPS.resellerDomainList, { query }, resellerDomainRefsOf)
            const held = refs.find((ref) => sameName(ref.name, name))
            return held === undefined
                ? null
                : { name: held.name, providerId: held.id, status: null, expiresOn: null, nameservers: null, autoRenew: null }
        }
        const page = await this.run(connection, INET_OPS.portalDomainList, { query }, portalDomainPageOf)
        const held = page.content.find((domain) => sameName(domain.name, name))
        return held === undefined ? null : recordOfPortal(held)
    }

    /** Reads the registrar's record of one held domain. */
    async details(connection: ConnectionRecord, domain: DomainRecord): Promise<DomainRecord> {
        // The reseller detail (`GET /reseller/domains/{id}`) publishes no answer members: the held record is all that is known.
        if (familyOf(connection) === "reseller") return domain
        const call = { path: { domainId: domain.providerId } }
        return recordOfPortal(await this.run(connection, INET_OPS.portalDomainGet, call, portalDomainDetailOf))
    }

    /** Lists a page of the domains the account holds. */
    async list(connection: ConnectionRecord, query: DomainListQuery): Promise<DomainPage> {
        const asked = { page: String(query.page), pageSize: String(query.pageSize) }
        if (familyOf(connection) === "reseller") {
            const refs = await this.run(connection, INET_OPS.resellerDomainList, { query: asked }, resellerDomainRefsOf)
            const domains = refs.map(
                (ref): DomainRecord => ({
                    name: ref.name,
                    providerId: ref.id,
                    status: null,
                    expiresOn: null,
                    nameservers: null,
                    autoRenew: null,
                }),
            )
            return { domains, page: query.page, totalPages: null }
        }
        const page = await this.run(connection, INET_OPS.portalDomainList, { query: asked }, portalDomainPageOf)
        return { domains: page.content.map((domain) => recordOfPortal(domain)), page: query.page, totalPages: page.totalPages }
    }

    /** Registers a new domain for the account. */
    async register(connection: ConnectionRecord, request: DomainRegistrationRequest): Promise<DomainOrderReceipt> {
        if (familyOf(connection) !== "reseller") return notAvailable("portal registration undocumented")
        if (request.contacts.length === 0) throw registrarRefusal("contacts_required")
        if (request.nameservers.length === 0) throw registrarRefusal("rejected", "nsList required")
        const body: InetData = {
            name: request.name,
            period: request.years,
            customerId: this.customerOf(connection),
            nsList: nsListOf(request.nameservers),
            contacts: request.contacts.map((contact) => contactOf(contact)),
        }
        const data = await this.run(connection, INET_OPS.resellerRegister, { body }, inetDataAsIs)
        return { name: request.name, reference: null, total: null, providerData: inetDataAsIs(data) }
    }

    /** Renews a held domain. */
    async renew(connection: ConnectionRecord, request: DomainRenewalRequest): Promise<DomainOrderReceipt> {
        if (familyOf(connection) !== "reseller") return notAvailable("portal renewal undocumented")
        const call = { path: { id: request.domain.providerId }, body: { period: request.years } }
        const data = await this.run(connection, INET_OPS.resellerRenew, call, inetDataAsIs)
        return { name: request.domain.name, reference: null, total: null, providerData: inetDataAsIs(data) }
    }

    /** Starts the transfer of a domain into the account. */
    async transfer(connection: ConnectionRecord, request: DomainTransferRequest): Promise<DomainOrderReceipt> {
        if (familyOf(connection) !== "reseller") return notAvailable("portal transfer undocumented")
        const body = { name: request.name, authCode: request.authCode, customerId: this.customerOf(connection) }
        const data = await this.run(connection, INET_OPS.resellerTransferIn, { body }, inetDataAsIs)
        return { name: request.name, reference: null, total: null, providerData: inetDataAsIs(data) }
    }

    /** Lists the DNS records of a held domain. */
    async dnsRecords(connection: ConnectionRecord, domain: DomainRecord): Promise<DnsRecordList> {
        if (familyOf(connection) === "reseller") {
            const call = { path: { id: domain.providerId } }
            return { kind: "undocumented", providerData: await this.run(connection, INET_OPS.resellerRecordList, call, inetDataAsIs) }
        }
        return { kind: "parsed", records: (await this.portalRecords(connection, domain)).map((record) => recordOfDns(record)) }
    }

    /** Adds a DNS record to a held domain. */
    async createDnsRecord(connection: ConnectionRecord, domain: DomainRecord, record: DnsRecordInput): Promise<DomainChange> {
        return this.writeRecords(connection, domain, [this.addItem(connection, domain, record)])
    }

    /** Changes a DNS record of a held domain. */
    async updateDnsRecord(
        connection: ConnectionRecord,
        domain: DomainRecord,
        recordId: string,
        record: DnsRecordInput,
    ): Promise<DomainChange> {
        // iNET documents an update as two items of one call: the delete of the old record, then the add of the new one.
        const remove = await this.deleteItem(connection, domain, recordId)
        return this.writeRecords(connection, domain, [remove, this.addItem(connection, domain, record)])
    }

    /** Removes a DNS record of a held domain. */
    async deleteDnsRecord(connection: ConnectionRecord, domain: DomainRecord, recordId: string): Promise<DomainChange> {
        return this.writeRecords(connection, domain, [await this.deleteItem(connection, domain, recordId)])
    }

    /** Replaces the name servers of a held domain. */
    async updateNameservers(
        connection: ConnectionRecord,
        domain: DomainRecord,
        nameservers: ReadonlyArray<string>,
    ): Promise<DomainChange> {
        const body = { nsList: nsListOf(nameservers) }
        if (familyOf(connection) === "reseller") {
            const call = { path: { id: domain.providerId }, body }
            const data = await this.run(connection, INET_OPS.resellerNameserverUpdate, call, inetDataAsIs)
            return { name: domain.name, records: null, providerData: data }
        }
        const call = { path: { domainId: domain.providerId }, body }
        await this.run(connection, INET_OPS.portalNameserverUpdate, call, portalDomainDetailOf)
        return { name: domain.name, records: null, providerData: null }
    }

    /** The reseller customer that manages the account's domains (`customerId`, required by registration and transfer). */
    private customerOf(connection: ConnectionRecord): number {
        const id = Number(connection.meta[INET_META.customerId] ?? "")
        return Number.isInteger(id) && id > 0 ? id : notAvailable("customer id not set")
    }

    /** The Portal records of a domain (the members published). */
    private async portalRecords(connection: ConnectionRecord, domain: DomainRecord): Promise<ReadonlyArray<InetPortalRecord>> {
        return this.run(connection, INET_OPS.portalRecordList, { path: { domainId: domain.providerId } }, portalRecordsOf)
    }

    /**
     * One add item. Portal: `{ name, type, data, ttl (string), action: ACTION_ADD, domainId }`; reseller: `{ action: add, type, name,
     * data }`. A member the context's request does not document (a priority on either, a ttl on the reseller) is refused, never sent.
     */
    private addItem(connection: ConnectionRecord, domain: DomainRecord, record: DnsRecordInput): InetData {
        if (record.priority !== null) throw registrarRefusal("rejected", "priority not taken")
        if (familyOf(connection) === "reseller") {
            if (record.ttl !== null) throw registrarRefusal("rejected", "ttl not taken")
            return { action: "add", type: record.type, name: record.name, data: record.value }
        }
        return {
            name: record.name,
            type: record.type,
            data: record.value,
            ...(record.ttl === null ? {} : { ttl: String(record.ttl) }),
            action: "ACTION_ADD",
            domainId: Number(domain.providerId),
        }
    }

    /**
     * One delete item. Portal: the old record's `name`, `type`, `data` are required members of an item, so the record is read first
     * (refused `not_found` when the domain has no record of that id); reseller: `{ action: del, id }`.
     */
    private async deleteItem(connection: ConnectionRecord, domain: DomainRecord, recordId: string): Promise<InetData> {
        if (familyOf(connection) === "reseller") return { action: "del", id: Number(recordId) }
        const old = (await this.portalRecords(connection, domain)).find((record) => record.id === recordId)
        if (old === undefined) throw registrarRefusal("not_found", "record")
        return { id: Number(recordId), name: old.name, type: old.type, data: old.data, action: "ACTION_DELETE", domainId: Number(domain.providerId) }
    }

    /** Sends the items in one record call of the account's context and answers the change. */
    private async writeRecords(
        connection: ConnectionRecord,
        domain: DomainRecord,
        items: ReadonlyArray<InetData>,
    ): Promise<DomainChange> {
        const body = { recordList: items }
        if (familyOf(connection) === "reseller") {
            const call = { path: { id: domain.providerId }, body }
            const data = await this.run(connection, INET_OPS.resellerRecordUpdate, call, inetDataAsIs)
            return { name: domain.name, records: null, providerData: data }
        }
        const call = { path: { domainId: domain.providerId }, body }
        const records = await this.run(connection, INET_OPS.portalRecordUpdate, call, portalRecordsOf)
        return { name: domain.name, records: records.map((record) => recordOfDns(record)), providerData: null }
    }

    /**
     * Runs one operation with the account's key and reads its answer; no key is the refusal `not_available` (nothing was sent). A
     * failure of the call or of the read is typed where it is caught (`inetFailureOf`): an answer that cannot be read was sent.
     */
    private async run<T>(
        connection: ConnectionRecord,
        operation: InetOperation,
        call: InetCall,
        read: (data: unknown) => T,
    ): Promise<T> {
        const key = await this.tokens.read(connection.id)
        if (key === null) return notAvailable("no api key")
        try {
            return read(await this.inet.call(key, operation, call))
        } catch (cause) {
            const failure = inetFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
