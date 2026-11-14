import { Injectable } from "@nestjs/common"
import { z } from "zod"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ProviderSandboxService, type SandboxCallPlan, type SandboxFailure } from "@modules/domain/provider-sandbox"
import {
    providerCallFailure,
    registrarRefusal,
    type DnsRecordInput,
    type DnsRecordList,
    type DomainAvailability,
    type DomainChange,
    type DomainListQuery,
    type DomainOrderReceipt,
    type DomainPage,
    type DomainRecord,
    type DomainRefusalReason,
    type DomainRegistrarPort,
    type DomainRegistrationRequest,
    type DomainRenewalRequest,
    type DomainTransferRequest,
} from "@modules/domain/provider-registry"
import { TINO_PROVIDER } from "./tino-connection-fields.policy"

/** A provider answer kept as it came (the port's `ProviderData`). */
type ProviderData = Readonly<Record<string, unknown>>

/** The date a default renewal counts its years from (a constant: the sandbox answers the same on every day). */
const RENEWAL_BASE = "2026-12-07"

/** A domain fixture, in the port's members. */
const recordSchema = z.object({
    name: z.string(),
    providerId: z.string(),
    status: z.string().nullable(),
    expiresOn: z.string().nullable(),
    nameservers: z.array(z.string()).nullable(),
    autoRenew: z.boolean().nullable(),
})

/** One period's prices of an availability fixture. */
const priceSchema = z.object({
    years: z.number(),
    register: z.number().nullable(),
    renew: z.number().nullable(),
    transfer: z.number().nullable(),
})

/** An availability fixture. */
const availabilitySchema = z.object({ available: z.boolean(), prices: z.array(priceSchema).default([]) })

/** A list fixture: one page of domains. */
const pageSchema = z.object({ domains: z.array(recordSchema), totalPages: z.number().nullable().optional() })

/** A provider answer kept as it came. */
const dataSchema = z.record(z.string(), z.unknown())

/** A receipt fixture: what it states replaces the deterministic default. */
const receiptSchema = z.object({
    reference: z.string().nullable().optional(),
    total: z.number().nullable().optional(),
    providerData: dataSchema.nullable().optional(),
})

/** The refusal words a script may name that Tino's port has its own reason for; any other word is a `rejected` with the word as Tino's code. */
const OWN_REASONS: ReadonlyArray<DomainRefusalReason> = ["not_available", "not_found", "already_exists"]

/**
 * What a scripted failure is, as the LIVE Tino throws it (`tinoFailureOf`): `refused` = the route's business refusal, `rejected` with
 * the reason word as Tino's code; `unavailable` / `timeout` = an unreachable API or a 5xx, the effect unknown; `auth_expired` = the
 * gateway refusing the token (401 / 403), nothing sent; `not_found` = the account holds no such domain.
 */
const failureOf = (failure: SandboxFailure): Error => {
    switch (failure.kind) {
        case "refused": {
            const own = OWN_REASONS.find((reason) => reason === failure.reason)
            return own === undefined ? registrarRefusal("rejected", failure.reason ?? null) : registrarRefusal(own, failure.reason ?? null)
        }
        case "not_found":
            return registrarRefusal("not_found", failure.reason ?? null)
        case "auth_expired":
            return providerCallFailure("not_sent")
        case "unavailable":
        case "timeout":
            return providerCallFailure("unknown")
    }
}

/** A fixture or script value that does not read as the port type is a typed refusal, never a silent default. */
const read = <Value>(schema: z.ZodType<Value>, given: unknown): Value => {
    const parsed = schema.safeParse(given)
    if (!parsed.success) throw registrarRefusal("rejected", "invalid_fixture")
    return parsed.data
}

/** The lower-cased domain name every key of a sandbox call is. */
const keyOf = (name: string): string => name.trim().toLowerCase()

/** The end date `years` after the constant base. */
const endAfter = (years: number): string => {
    const base = new Date(`${RENEWAL_BASE}T00:00:00.000Z`)
    base.setUTCFullYear(base.getUTCFullYear() + years)
    return base.toISOString().slice(0, 10)
}

/** The same refusal as the live adapter: Tino's DNS write takes no ttl. */
const dnsRefusal = (record: DnsRecordInput): void => {
    if (record.ttl !== null) throw registrarRefusal("rejected", "ttl not taken")
}

@Injectable()
/**
 * Tino's SANDBOX implementation of the domain registrar port (owner ruling R56/R57), used when a Tino connection is a sandbox account:
 * every call is answered by the generic sandbox frame from the account's fixtures and scripts (else a deterministic default) and logged,
 * and nothing leaves the process. What the live adapter refuses before it sends (contacts on a registration, a ttl on a DNS write) is
 * refused the same way here, so a sandbox test cannot pass a flow the live cannot do.
 */
export class TinoSandboxRegistrarService implements DomainRegistrarPort {
    /** The provider key of the accounts it serves: the live adapter's. */
    readonly provider: typeof TINO_PROVIDER = TINO_PROVIDER

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Answers the account's availability fixture, else "available" with no prices. */
    availability(connection: ConnectionRecord, name: string): Promise<DomainAvailability> {
        return this.sandbox.call(
            connection,
            "availability",
            { name },
            this.plan(keyOf(name), (given) => (given === null ? { name, available: true, prices: [] } : { name, ...read(availabilitySchema, given) })),
        )
    }

    /** Answers the account's `find` fixture for the name, else null (not held). */
    find(connection: ConnectionRecord, name: string): Promise<DomainRecord | null> {
        return this.sandbox.call(
            connection,
            "find",
            { name },
            this.plan(keyOf(name), (given) => (given === null ? null : read(recordSchema, given))),
        )
    }

    /** Answers the account's `details` fixture for the domain, else the refusal of a domain the account does not hold. */
    details(connection: ConnectionRecord, domain: DomainRecord): Promise<DomainRecord> {
        return this.sandbox.call(
            connection,
            "details",
            { domain },
            this.plan(keyOf(domain.name), (given) => {
                if (given === null) throw registrarRefusal("not_found")
                return read(recordSchema, given)
            }),
        )
    }

    /** Answers the account's `list` fixture (a page of domains), else an empty page. */
    list(connection: ConnectionRecord, query: DomainListQuery): Promise<DomainPage> {
        return this.sandbox.call(
            connection,
            "list",
            query,
            this.plan("", (given) => {
                const fixture = given === null ? { domains: [], totalPages: null } : read(pageSchema, given)
                return { domains: fixture.domains, page: query.page, totalPages: fixture.totalPages ?? null }
            }),
        )
    }

    /** Refuses contacts like the live adapter, then takes one `register` call; the default is a deterministic receipt. */
    register(connection: ConnectionRecord, request: DomainRegistrationRequest): Promise<DomainOrderReceipt> {
        if (request.contacts.length > 0) throw registrarRefusal("contacts_unsupported")
        const reference = `sbx-register-${keyOf(request.name)}-${String(request.years)}`
        return this.sandbox.call(
            connection,
            "register",
            request,
            this.plan(keyOf(request.name), (given) => this.receiptOf(request.name, reference, given)),
        )
    }

    /** Takes one `renew` call; the default is a valid receipt whose new end date is the constant base plus the requested years. */
    renew(connection: ConnectionRecord, request: DomainRenewalRequest): Promise<DomainOrderReceipt> {
        const reference = `sbx-renew-${keyOf(request.domain.name)}-${String(request.years)}`
        const expiresOn = endAfter(request.years)
        return this.sandbox.call(
            connection,
            "renew",
            request,
            this.plan(keyOf(request.domain.name), (given) => this.receiptOf(request.domain.name, reference, given, { expiresOn })),
        )
    }

    /** Takes one `transfer` call; the default is a deterministic receipt. */
    transfer(connection: ConnectionRecord, request: DomainTransferRequest): Promise<DomainOrderReceipt> {
        const reference = `sbx-transfer-${keyOf(request.name)}-${String(request.years)}`
        return this.sandbox.call(
            connection,
            "transfer",
            request,
            this.plan(keyOf(request.name), (given) => this.receiptOf(request.name, reference, given)),
        )
    }

    /** Answers the account's `dnsRecords` fixture as an undocumented answer (the live Tino states no record members), else an empty list. */
    dnsRecords(connection: ConnectionRecord, domain: DomainRecord): Promise<DnsRecordList> {
        return this.sandbox.call(
            connection,
            "dnsRecords",
            { domain },
            this.plan(
                keyOf(domain.name),
                (given): DnsRecordList => ({ kind: "undocumented", providerData: given === null ? { records: [] } : read(dataSchema, given) }),
            ),
        )
    }

    /** Refuses a ttl like the live adapter, then takes one `createDnsRecord` call. */
    createDnsRecord(connection: ConnectionRecord, domain: DomainRecord, record: DnsRecordInput): Promise<DomainChange> {
        dnsRefusal(record)
        return this.change(connection, "createDnsRecord", domain, { domain, record })
    }

    /** Refuses a ttl like the live adapter, then takes one `updateDnsRecord` call. */
    updateDnsRecord(connection: ConnectionRecord, domain: DomainRecord, recordId: string, record: DnsRecordInput): Promise<DomainChange> {
        dnsRefusal(record)
        return this.change(connection, "updateDnsRecord", domain, { domain, recordId, record })
    }

    /** Takes one `deleteDnsRecord` call. */
    deleteDnsRecord(connection: ConnectionRecord, domain: DomainRecord, recordId: string): Promise<DomainChange> {
        return this.change(connection, "deleteDnsRecord", domain, { domain, recordId })
    }

    /** Takes one `updateNameservers` call. */
    updateNameservers(connection: ConnectionRecord, domain: DomainRecord, nameservers: ReadonlyArray<string>): Promise<DomainChange> {
        return this.change(connection, "updateNameservers", domain, { domain, nameservers })
    }

    private change(connection: ConnectionRecord, operation: string, domain: DomainRecord, request: unknown): Promise<DomainChange> {
        return this.sandbox.call(
            connection,
            operation,
            request,
            this.plan(keyOf(domain.name), (given) => ({
                name: domain.name,
                records: null,
                providerData: given === null ? { accepted: true } : read(dataSchema, given),
            })),
        )
    }

    private receiptOf(name: string, reference: string, given: unknown, defaults: ProviderData = {}): DomainOrderReceipt {
        const fallback: ProviderData = { sandbox: true, ...defaults }
        if (given === null) return { name, reference, total: null, providerData: fallback }
        const receipt = read(receiptSchema, given)
        return { name, reference: receipt.reference ?? reference, total: receipt.total ?? null, providerData: receipt.providerData ?? fallback }
    }

    private plan<Answer>(key: string, answer: (given: unknown) => Answer): SandboxCallPlan<Answer> {
        return { key, answer, fail: failureOf }
    }
}
