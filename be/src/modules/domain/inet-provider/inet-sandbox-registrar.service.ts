import { Injectable } from "@nestjs/common"
import { z } from "zod"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ProviderSandboxError, ProviderSandboxErrorCode, ProviderSandboxService, type SandboxCallPlan, type SandboxFailure } from "@modules/domain/provider-sandbox"
import {
    providerCallFailure,
    registrarRefusal,
    type DnsRecord,
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
import { INET_PROVIDER } from "./inet-connection-fields.policy"

/** The fixed date a renewal counts from when the held domain states no expiry (a sandbox answer is deterministic, never the clock). */
const SANDBOX_BASE_DATE = "2026-11-14"

const optionalString = z
    .string()
    .nullish()
    .transform((value) => value ?? null)
const optionalNumber = z
    .number()
    .nullish()
    .transform((value) => value ?? null)
const optionalData = z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((value) => value ?? null)
const dnsRecordFixture = z.looseObject({
    id: optionalString,
    name: z.string(),
    type: z.string(),
    value: z.string(),
    ttl: optionalNumber,
    priority: optionalNumber,
})
const recordFixture = z.looseObject({
    name: z.string(),
    providerId: z.string().optional(),
    status: optionalString,
    expiresOn: optionalString,
    nameservers: z
        .array(z.string())
        .nullish()
        .transform((value) => value ?? null),
    autoRenew: z
        .boolean()
        .nullish()
        .transform((value) => value ?? null),
})
const pageFixture = z.looseObject({
    domains: z.array(recordFixture),
    page: z.number().optional(),
    totalPages: optionalNumber,
})
const availabilityFixture = z.looseObject({
    name: z.string().optional(),
    available: z.boolean(),
    prices: z
        .array(z.looseObject({ years: z.number(), register: optionalNumber, renew: optionalNumber, transfer: optionalNumber }))
        .optional(),
})
const receiptFixture = z.looseObject({
    name: z.string().optional(),
    reference: optionalString,
    total: optionalNumber,
    providerData: optionalData,
})
const changeFixture = z.looseObject({
    records: z
        .array(dnsRecordFixture)
        .nullish()
        .transform((value) => value ?? null),
    providerData: optionalData,
})
const dnsListFixture = z.looseObject({ records: z.array(dnsRecordFixture) })

/** The sandbox's own typed error for a fixture that does not read as the port's shape (never a crash of the engine). */
const badFixture = (operation: string, issue: string): ProviderSandboxError =>
    new ProviderSandboxError({ code: ProviderSandboxErrorCode.EntryInvalid, params: { why: `fixture ${operation}: ${issue}` } })

/** Reads a fixture or scripted value with a schema; a value that does not parse is a thrown `ProviderSandboxError`. */
const readAs = <Schema extends z.ZodType>(schema: Schema, operation: string, value: unknown): z.output<Schema> => {
    const parsed = schema.safeParse(value)
    if (!parsed.success) throw badFixture(operation, parsed.error.issues[0]?.message ?? "invalid")
    return parsed.data
}

/** The reason words a scripted refusal names, as the live iNET answers them: a conflict (409) is `already_exists`, the rest are the request refused (`rejected`). */
const REFUSAL_OF_REASON: Readonly<Record<string, DomainRefusalReason>> = {
    insufficient_balance: "rejected",
    domain_locked: "rejected",
    rejected: "rejected",
    already_renewed: "already_exists",
    already_exists: "already_exists",
    not_found: "not_found",
    not_available: "not_available",
    contacts_required: "contacts_required",
    contacts_unsupported: "contacts_unsupported",
}

/**
 * A scripted failure as the error the LIVE iNET adapter throws for the same case (`inetFailureOf`): a refusal names its reason word as
 * the provider code (`rejected` 400, `already_exists` 409); `unavailable` (5xx) and `timeout` prove `unknown`; a refused credential
 * (401 / 403) proves `not_sent`; `not_found` is the registrar's not-found refusal.
 */
export const inetSandboxFailureOf = (failure: SandboxFailure): Error => {
    const code = failure.reason ?? null
    switch (failure.kind) {
        case "refused":
            return registrarRefusal(REFUSAL_OF_REASON[code ?? ""] ?? "rejected", code)
        case "not_found":
            return registrarRefusal("not_found", code)
        case "unavailable":
        case "timeout":
            return providerCallFailure("unknown")
        case "auth_expired":
            return providerCallFailure("not_sent")
    }
}

/** Adds whole years to a `yyyy-mm-dd` date (UTC), or to the base date when there is none or the text is no date. */
const addYears = (from: string | null, years: number): string => {
    const start = new Date(from === null ? SANDBOX_BASE_DATE : from)
    const base = Number.isNaN(start.getTime()) ? new Date(SANDBOX_BASE_DATE) : start
    base.setUTCFullYear(base.getUTCFullYear() + years)
    return base.toISOString().slice(0, 10)
}

/** A domain record of a fixture, in the port's words (the provider id defaults to a sandbox id of the name). */
const recordOf = (parsed: z.output<typeof recordFixture>): DomainRecord => ({
    name: parsed.name,
    providerId: parsed.providerId ?? `sbx-${parsed.name.toLowerCase()}`,
    status: parsed.status,
    expiresOn: parsed.expiresOn,
    nameservers: parsed.nameservers,
    autoRenew: parsed.autoRenew,
})

/** A DNS record of a fixture, in the port's words. */
const dnsOf = (parsed: z.output<typeof dnsRecordFixture>): DnsRecord => ({
    id: parsed.id,
    name: parsed.name,
    type: parsed.type,
    value: parsed.value,
    ttl: parsed.ttl,
    priority: parsed.priority,
})

/** The lower-case key of a domain name. */
const keyOf = (name: string): string => name.trim().toLowerCase()

/** The plan of one call: its key, its answer from the given fixture, and the live error of a scripted failure. */
const planOf = <Answer>(key: string, answer: (given: unknown) => Answer): SandboxCallPlan<Answer> => ({
    key,
    answer,
    fail: (failure) => inetSandboxFailureOf(failure),
})

@Injectable()
/**
 * iNET's SANDBOX implementation of the domain registrar port (owner rulings R56 / R57): used when the provider account is a sandbox
 * account, it answers every purpose through the generic sandbox frame, from the account's fixtures and scripted outcomes, with
 * deterministic defaults, and logs every call. It holds no client and no secret: it never reaches a host. A scripted failure becomes
 * the error the live adapter throws for the same case.
 */
export class InetSandboxRegistrarService implements DomainRegistrarPort {
    readonly provider: typeof INET_PROVIDER = INET_PROVIDER

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Whether a name can be registered: the fixture, else available. */
    availability(connection: ConnectionRecord, name: string): Promise<DomainAvailability> {
        return this.sandbox.call(
            connection,
            "availability",
            { name },
            planOf(keyOf(name), (given) => {
                if (given === null) return { name, available: true, prices: [] }
                const parsed = readAs(availabilityFixture, "availability", given)
                return { name: parsed.name ?? name, available: parsed.available, prices: parsed.prices ?? [] }
            }),
        )
    }

    /** The held domain of this name: the fixture, else null (not held). */
    find(connection: ConnectionRecord, name: string): Promise<DomainRecord | null> {
        return this.sandbox.call(
            connection,
            "find",
            { name },
            planOf(keyOf(name), (given) => (given === null ? null : recordOf(readAs(recordFixture, "find", given)))),
        )
    }

    /** The detail of a held domain: the fixture, else the refusal `not_found` as the live answers for a domain it does not hold. */
    details(connection: ConnectionRecord, domain: DomainRecord): Promise<DomainRecord> {
        return this.sandbox.call(
            connection,
            "details",
            { domain },
            planOf(keyOf(domain.name), (given) => {
                if (given === null) throw registrarRefusal("not_found")
                return recordOf(readAs(recordFixture, "details", given))
            }),
        )
    }

    /** A page of held domains: the fixture, else an empty first page. */
    list(connection: ConnectionRecord, query: DomainListQuery): Promise<DomainPage> {
        return this.sandbox.call(
            connection,
            "list",
            { query },
            planOf("", (given) => {
                if (given === null) return { domains: [], page: query.page, totalPages: 1 }
                const parsed = readAs(pageFixture, "list", given)
                return { domains: parsed.domains.map((domain) => recordOf(domain)), page: parsed.page ?? query.page, totalPages: parsed.totalPages }
            }),
        )
    }

    /** Registers a name: the fixture receipt, else a receipt `sbx-register-<name>-<years>`. */
    register(connection: ConnectionRecord, request: DomainRegistrationRequest): Promise<DomainOrderReceipt> {
        const reference = `sbx-register-${keyOf(request.name)}-${String(request.years)}`
        return this.sandbox.call(
            connection,
            "register",
            request,
            planOf(keyOf(request.name), (given) => this.receiptOf("register", request.name, reference, given, null)),
        )
    }

    /**
     * Renews a held domain: a fixture or scripted string is the new end date, an object is the receipt; else the new end date is the
     * domain's stated expiry (or the fixed base date) plus the years, with the reference `sbx-renew-<name>-<years>`.
     */
    renew(connection: ConnectionRecord, request: DomainRenewalRequest): Promise<DomainOrderReceipt> {
        const name = request.domain.name
        const reference = `sbx-renew-${keyOf(name)}-${String(request.years)}`
        const expiresOn = addYears(request.domain.expiresOn, request.years)
        return this.sandbox.call(
            connection,
            "renew",
            request,
            planOf(keyOf(name), (given) => {
                if (typeof given === "string") return { name, reference, total: null, providerData: { expiresOn: given } }
                return this.receiptOf("renew", name, reference, given, { expiresOn })
            }),
        )
    }

    /** Starts a transfer in: the fixture receipt, else a receipt `sbx-transfer-<name>-<years>`. */
    transfer(connection: ConnectionRecord, request: DomainTransferRequest): Promise<DomainOrderReceipt> {
        const reference = `sbx-transfer-${keyOf(request.name)}-${String(request.years)}`
        return this.sandbox.call(
            connection,
            "transfer",
            request,
            planOf(keyOf(request.name), (given) => this.receiptOf("transfer", request.name, reference, given, null)),
        )
    }

    /** The DNS records of a held domain: the fixture, else an empty parsed list. */
    dnsRecords(connection: ConnectionRecord, domain: DomainRecord): Promise<DnsRecordList> {
        return this.sandbox.call(
            connection,
            "dnsRecords",
            { domain },
            planOf(keyOf(domain.name), (given): DnsRecordList => {
                if (given === null) return { kind: "parsed", records: [] }
                return { kind: "parsed", records: readAs(dnsListFixture, "dnsRecords", given).records.map((record) => dnsOf(record)) }
            }),
        )
    }

    /** Adds one DNS record: the fixture change, else an accepted change with no records stated. */
    createDnsRecord(connection: ConnectionRecord, domain: DomainRecord, record: DnsRecordInput): Promise<DomainChange> {
        return this.change(connection, "createDnsRecord", domain, { domain, record })
    }

    /** Replaces one DNS record: the fixture change, else an accepted change. */
    updateDnsRecord(connection: ConnectionRecord, domain: DomainRecord, recordId: string, record: DnsRecordInput): Promise<DomainChange> {
        return this.change(connection, "updateDnsRecord", domain, { domain, recordId, record })
    }

    /** Removes one DNS record: the fixture change, else an accepted change. */
    deleteDnsRecord(connection: ConnectionRecord, domain: DomainRecord, recordId: string): Promise<DomainChange> {
        return this.change(connection, "deleteDnsRecord", domain, { domain, recordId })
    }

    /** Replaces the nameservers: the fixture change, else an accepted change. */
    updateNameservers(connection: ConnectionRecord, domain: DomainRecord, nameservers: ReadonlyArray<string>): Promise<DomainChange> {
        return this.change(connection, "updateNameservers", domain, { domain, nameservers })
    }

    /** One write on a held domain through exactly one sandbox call. */
    private change(connection: ConnectionRecord, operation: string, domain: DomainRecord, request: unknown): Promise<DomainChange> {
        return this.sandbox.call(
            connection,
            operation,
            request,
            planOf(keyOf(domain.name), (given): DomainChange => {
                if (given === null) return { name: domain.name, records: null, providerData: null }
                const parsed = readAs(changeFixture, operation, given)
                return {
                    name: domain.name,
                    records: parsed.records === null ? null : parsed.records.map((record) => dnsOf(record)),
                    providerData: parsed.providerData,
                }
            }),
        )
    }

    /** A receipt from a fixture, or the deterministic default with its reference and what the sandbox says in `providerData`. */
    private receiptOf(operation: string, name: string, reference: string, given: unknown, data: Record<string, unknown> | null): DomainOrderReceipt {
        if (given === null) return { name, reference, total: null, providerData: data }
        const parsed = readAs(receiptFixture, operation, given)
        return { name: parsed.name ?? name, reference: parsed.reference ?? reference, total: parsed.total, providerData: parsed.providerData ?? data }
    }
}
