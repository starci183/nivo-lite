import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"

/**
 * The bounded arguments of the generic domain tools (`nivo.tool.domain.*`). Bounds that hold for EVERY registrar served (iNET and Tino),
 * each from their documentation: a name is a DNS name (253 characters at most); a registration lasts 1 to 10 years (Tino's lookup
 * lists 10 periods); nameservers are 2 to 4 (Tino: "2 - 4 nameservers", iNET: 2 to 12, so the common bound is 2 to 4).
 */

/** A domain name: what the registrar spells (the providers convert a Vietnamese name to punycode themselves). */
const NAME = z.string().trim().min(3).max(253)

/** A host name of a nameserver. */
const HOST = z.string().trim().min(3).max(253)

/** The years of a registration, renewal or transfer. */
const YEARS = z.number().int().min(1).max(10)

/** The nameservers of a domain, when a call gives them. */
const NAMESERVERS = z.array(HOST).min(2).max(4)

/** One DNS record to write: the members both registrars document (iNET `name`, `type`, `data`, `ttl`; Tino `name`, `type`, `content`, `priority`). */
const RECORD = z
    .object({
        name: z.string().trim().min(1).max(253),
        type: z.string().trim().min(1).max(16),
        value: z.string().min(1).max(4096),
        ttl: z.number().int().min(1).max(2_147_483_647).nullable().default(null),
        priority: z.number().int().min(0).max(65_535).nullable().default(null),
    })
    .strict()

/** One contact of a registration (the members iNET's registration documents). */
const CONTACT = z
    .object({
        role: z.enum(["registrant", "admin", "technical", "billing"]),
        fullName: z.string().trim().min(1).max(200),
        organization: z.boolean(),
        email: z.string().trim().min(3).max(254),
        phone: z.string().trim().min(6).max(20),
        country: z.string().trim().length(2),
        province: z.string().trim().min(1).max(64),
        address: z.string().trim().min(1).max(255),
        ward: z.string().trim().min(1).max(128),
        taxCode: z.string().trim().min(1).max(20).exactOptional(),
        idNumber: z.string().trim().min(1).max(20).exactOptional(),
        gender: z.string().trim().min(1).max(10).exactOptional(),
        birthday: z.string().trim().length(10).exactOptional(),
    })
    .strict()

/** A domain the call is about. */
export const DOMAIN_NAME_SCHEMA: z.ZodType<{ name: string; }> = z.object({ name: NAME }).strict()

/** A page of the account's domains. */
export const DOMAIN_LIST_SCHEMA: z.ZodType<{ page: number; pageSize: number; }> = z
    .object({ page: z.number().int().min(1).max(1000).default(1), pageSize: z.number().int().min(1).max(100).default(20) })
    .strict()

/** A registration. */
export const DOMAIN_REGISTER_SCHEMA: z.ZodType<{ name: string; years: number; nameservers?: Array<string> | undefined; contacts?: Array<{ role: "registrant" | "admin" | "technical" | "billing"; fullName: string; organization: boolean; email: string; phone: string; country: string; province: string; address: string; ward: string; taxCode?: string; idNumber?: string; gender?: string; birthday?: string; }> | undefined; }> = z
    .object({
        name: NAME,
        years: YEARS,
        nameservers: NAMESERVERS.optional(),
        contacts: z.array(CONTACT).max(4).optional(),
    })
    .strict()

/**
 * A renewal of a held domain, or of a service the provider sells on it (`service`: `domain` when absent). The years bound is the
 * registration's (1 to 10).
 */
export const DOMAIN_RENEW_SCHEMA: z.ZodType<{ name: string; years: number; service?: "domain" | "hosting" | "ssl" | undefined; }> = z
    .object({ name: NAME, years: YEARS, service: z.enum(["domain", "hosting", "ssl"]).optional() })
    .strict()

/** An expiry as a registrar prints it (a date; its own format), kept from the renewal's answer. */
const EXPIRY = z.string().trim().min(1).max(40)

/** The check of a renewal of a held domain: the domain, the expiry the renewal answered as before it, and its order reference. */
export const DOMAIN_RENEWAL_GET_SCHEMA: z.ZodType<{ name: string; expiresBefore: string; reference?: string | null | undefined; }> = z
    .object({ name: NAME, expiresBefore: EXPIRY, reference: z.string().trim().min(1).max(200).nullable().optional() })
    .strict()

/** An incoming transfer. */
export const DOMAIN_TRANSFER_SCHEMA: z.ZodType<{ name: string; authCode: string; years: number; }> = z
    .object({ name: NAME, authCode: z.string().min(1).max(128), years: YEARS.default(1) })
    .strict()

/** One DNS record as a tool call names it. */
interface DnsRecordInput {
    /** The record name. */
    name: string
    /** The record type. */
    type: string
    /** The record value. */
    value: string
    /** The time to live in seconds, or null for the registrar default. */
    ttl: number | null
    /** The priority, or null when the type has none. */
    priority: number | null
}

/** A new DNS record of a held domain. */
export const DNS_CREATE_SCHEMA: z.ZodType<{ name: string; record: DnsRecordInput; }> = z.object({ name: NAME, record: RECORD }).strict()

/** A replaced DNS record of a held domain, by the id the record list answered. */
export const DNS_UPDATE_SCHEMA: z.ZodType<{ name: string; recordId: string; record: DnsRecordInput; }> = z.object({ name: NAME, recordId: z.string().min(1).max(64), record: RECORD }).strict()

/** A removed DNS record of a held domain. */
export const DNS_DELETE_SCHEMA: z.ZodType<{ name: string; recordId: string; }> = z.object({ name: NAME, recordId: z.string().min(1).max(64) }).strict()

/** New nameservers of a held domain. */
export const NAMESERVER_UPDATE_SCHEMA: z.ZodType<{ name: string; nameservers: Array<string>; }> = z.object({ name: NAME, nameservers: NAMESERVERS }).strict()

/** The schemas the manifest announces, generated from the validators. */
export const inputSchemaOf = (schema: z.ZodType): ToolJson => z.toJSONSchema(schema, { io: "input" })
