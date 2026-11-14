import { mock } from "@starci/jest-preset"
import type { ConnectionApiTokenService } from "@modules/domain/connection-secrets"
import { proofOf, ProviderRegistryError, registrarRefusalReason } from "@modules/domain/provider-registry"
import type { DomainRefusalReason } from "@modules/domain/provider-registry"
import type { DomainContact, DomainRecord } from "@modules/domain/provider-registry"
import { InetClient } from "@modules/integrations/inet/inet.client"
import type { HttpClient, HttpRequest } from "@modules/platform/http"
import {
    FAKE_KEY,
    INET_PORTAL_AVAILABLE,
    INET_PORTAL_DOMAIN_DETAIL,
    INET_PORTAL_DOMAIN_PAGE,
    INET_PORTAL_RECORDS,
    INET_RESELLER_DOMAIN_PAGE,
    inetOk,
    inetRefused,
    registrarAccountOf,
} from "@tests/fixtures/builders/domain-registrars.builder"
import { InetDomainRegistrarService } from "./inet-domain-registrar.service"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const BASE = "https://developers.inet.vn/api/gateway/v1"
const PORTAL = registrarAccountOf("c-portal", "inet", { api_context: "portal" })
const RESELLER = registrarAccountOf("c-reseller", "inet", { api_context: "reseller", customer_id: "42" })
const HELD: DomainRecord = {
    name: "example.vn",
    providerId: "123456",
    status: "active",
    expiresOn: null,
    nameservers: null,
    autoRenew: null,
}
const REGISTRANT: DomainContact = {
    role: "registrant",
    fullName: "C\u00f4ng ty A",
    organization: true,
    email: "company@example.vn",
    phone: "0438385588",
    country: "VN",
    province: "HNI",
    address: "247 C\u1ea7u Gi\u1ea5y",
    ward: "Ph\u01b0\u1eddng C\u1ea7u Gi\u1ea5y",
    taxCode: "0123456789",
}
const TECHNICAL: DomainContact = { ...REGISTRANT, role: "technical", organization: false, fullName: "Nguy\u1ec5n V\u0103n A" }

const build = (answer: (request: HttpRequest) => { readonly status: number; readonly body: unknown }, key: string | null = FAKE_KEY) => {
    const http = mock<HttpClient>()
    const sent: Array<HttpRequest> = []
    http.request.mockImplementation((request: HttpRequest) => {
        sent.push(request)
        return Promise.resolve(answer(request))
    })
    const tokens = mock<ConnectionApiTokenService>()
    tokens.read.mockResolvedValue(key)
    const client = new InetClient(http, { apiBase: BASE, timeoutMs: 4000 })
    return { registrar: new InetDomainRegistrarService(client, tokens), sent }
}

const refusalOf = async (work: Promise<unknown>): Promise<{ readonly reason: DomainRefusalReason; readonly providerCode: string | null }> => {
    const cause = await work.then(
        () => null,
        (error: unknown) => error,
    )
    const reason = registrarRefusalReason(cause)
    if (!(cause instanceof ProviderRegistryError) || reason === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no refusal" } })
    const providerCode = cause.params.providerCode
    return { reason, providerCode: typeof providerCode === "string" ? providerCode : null }
}

describe("InetDomainRegistrarService, the Portal key context", () => {
    it("answers availability from GET /domain/check-available", async () => {
        const { registrar, sent } = build(() => inetOk(INET_PORTAL_AVAILABLE))

        await expect(registrar.availability(PORTAL, "mywebsite.vn")).resolves.toEqual({
            name: "mywebsite.vn",
            available: true,
            prices: [],
        })
        expect(sent[0]?.url).toBe(`${BASE}/domain/check-available?name=mywebsite.vn`)
    })

    it("finds a held domain by the list filtered by name, and none when the list has no such name", async () => {
        const { registrar } = build(() => inetOk(INET_PORTAL_DOMAIN_PAGE))
        await expect(registrar.find(PORTAL, "EXAMPLE.vn")).resolves.toMatchObject({ name: "example.vn", providerId: "123456" })
        await expect(registrar.find(PORTAL, "other.vn")).resolves.toBeNull()
    })

    it("reads the details with the nameservers", async () => {
        const { registrar, sent } = build(() => inetOk(INET_PORTAL_DOMAIN_DETAIL))
        await expect(registrar.details(PORTAL, HELD)).resolves.toMatchObject({ nameservers: ["ns1.inet.vn", "ns2.inet.vn"] })
        expect(sent[0]?.url).toBe(`${BASE}/domain/123456`)
    })

    it("refuses registration, renewal and transfer `not_available` (the Portal API documents none) and sends nothing", async () => {
        const { registrar, sent } = build(() => inetOk({}))
        const request = { name: "a.vn", years: 1, nameservers: [], contacts: [] }
        expect((await refusalOf(registrar.register(PORTAL, request))).reason).toBe("not_available")
        expect((await refusalOf(registrar.renew(PORTAL, { domain: HELD, years: 1 }))).reason).toBe("not_available")
        expect((await refusalOf(registrar.transfer(PORTAL, { name: "a.vn", authCode: "x", years: 1 }))).reason).toBe("not_available")
        expect(sent).toEqual([])
    })

    it("lists the records as parsed", async () => {
        const { registrar } = build(() => inetOk(INET_PORTAL_RECORDS))
        const list = await registrar.dnsRecords(PORTAL, HELD)
        expect(list).toEqual({
            kind: "parsed",
            records: [
                { id: "9001", name: "@", type: "A", value: "1.2.3.4", ttl: 300, priority: null },
                { id: "9002", name: "www", type: "CNAME", value: "example.vn", ttl: 300, priority: null },
            ],
        })
    })

    it("updates a record as the documented pair: ACTION_DELETE of the old one (read first), ACTION_ADD of the new, in one call", async () => {
        const { registrar, sent } = build(() => inetOk(INET_PORTAL_RECORDS))
        const record = { name: "@", type: "A", value: "5.6.7.8", ttl: 600, priority: null }

        await registrar.updateDnsRecord(PORTAL, HELD, "9001", record)

        expect(sent[1]).toMatchObject({
            method: "PATCH",
            url: `${BASE}/domain/123456/record`,
            body: {
                recordList: [
                    { id: 9001, name: "@", type: "A", data: "1.2.3.4", action: "ACTION_DELETE", domainId: 123456 },
                    { name: "@", type: "A", data: "5.6.7.8", ttl: "600", action: "ACTION_ADD", domainId: 123456 },
                ],
            },
        })
    })

    it("refuses a delete of a record the domain does not have, and a priority the request does not document", async () => {
        const { registrar, sent } = build(() => inetOk(INET_PORTAL_RECORDS))
        expect((await refusalOf(registrar.deleteDnsRecord(PORTAL, HELD, "1"))).reason).toBe("not_found")
        const mx = { name: "@", type: "MX", value: "mx.example.vn", ttl: null, priority: 10 }
        expect((await refusalOf(registrar.createDnsRecord(PORTAL, HELD, mx))).providerCode).toBe("priority not taken")
        expect(sent.filter((request) => request.method === "PATCH")).toEqual([])
    })
})

describe("InetDomainRegistrarService, the reseller key context", () => {
    it("registers with the reseller customer id of the account and the documented contact types", async () => {
        const { registrar, sent } = build(() => inetOk({ id: 1, name: "test.vn" }))

        const receipt = await registrar.register(RESELLER, {
            name: "test.vn",
            years: 1,
            nameservers: ["ns1.inet.vn", "ns2.inet.vn"],
            contacts: [REGISTRANT, TECHNICAL],
        })

        expect(sent[0]).toMatchObject({
            method: "POST",
            url: `${BASE}/reseller/domains`,
            body: {
                name: "test.vn",
                period: 1,
                customerId: 42,
                nsList: [{ hostname: "ns1.inet.vn" }, { hostname: "ns2.inet.vn" }],
                contacts: [
                    expect.objectContaining({ type: "registrant", fullname: "C\u00f4ng ty A", organization: true, taxCode: "0123456789" }),
                    expect.objectContaining({ type: "technique", fullname: "Nguy\u1ec5n V\u0103n A" }),
                ],
            },
        })
        expect(receipt).toEqual({ name: "test.vn", reference: null, total: null, providerData: { id: 1, name: "test.vn" } })
    })

    it("refuses a registration without contacts, and one whose account has no customer id, before anything is sent", async () => {
        const { registrar, sent } = build(() => inetOk({}))
        const request = { name: "test.vn", years: 1, nameservers: ["ns1.inet.vn", "ns2.inet.vn"], contacts: [] }
        expect((await refusalOf(registrar.register(RESELLER, request))).reason).toBe("contacts_required")
        const bare = registrarAccountOf("c-bare", "inet", { api_context: "reseller" })
        expect((await refusalOf(registrar.register(bare, { ...request, contacts: [REGISTRANT] }))).reason).toBe("not_available")
        expect(sent).toEqual([])
    })

    it("renews by POST /reseller/domains/{id}/renew { period } and transfers in with the account's customer id", async () => {
        const { registrar, sent } = build(() => inetOk({}))
        await registrar.renew(RESELLER, { domain: HELD, years: 2 })
        await registrar.transfer(RESELLER, { name: "example.vn", authCode: "auth", years: 1 })
        expect(sent.map((request) => [request.method, request.url, request.body])).toEqual([
            ["POST", `${BASE}/reseller/domains/123456/renew`, { period: 2 }],
            ["POST", `${BASE}/reseller/domain-transfers`, { name: "example.vn", authCode: "auth", customerId: 42 }],
        ])
    })

    it("finds by the reseller list, refuses availability (its answer member is unpublished), keeps the records as they came", async () => {
        const { registrar, sent } = build((request) =>
            request.url.includes("/records") ? inetOk({ any: "shape" }) : inetOk(INET_RESELLER_DOMAIN_PAGE),
        )
        await expect(registrar.find(RESELLER, "example.vn")).resolves.toMatchObject({ providerId: "123456", status: null })
        expect((await refusalOf(registrar.availability(RESELLER, "x.vn"))).reason).toBe("not_available")
        await expect(registrar.dnsRecords(RESELLER, HELD)).resolves.toEqual({ kind: "undocumented", providerData: { any: "shape" } })
        expect(sent.map((request) => request.url)).toEqual([
            `${BASE}/reseller/domains?name=example.vn&page=1&pageSize=20`,
            `${BASE}/reseller/domains/123456/records`,
        ])
    })

    it("deletes a record by { action: del, id } and adds one by { action: add, type, name, data }", async () => {
        const { registrar, sent } = build(() => inetOk({}))
        await registrar.updateDnsRecord(RESELLER, HELD, "77", { name: "www", type: "A", value: "1.1.1.1", ttl: null, priority: null })
        expect(sent[0]?.body).toEqual({
            recordList: [
                { action: "del", id: 77 },
                { action: "add", type: "A", name: "www", data: "1.1.1.1" },
            ],
        })
    })
})

describe("InetDomainRegistrarService, what a failure proves", () => {
    it.each([
        [401, "not_sent"],
        [403, "not_sent"],
        [404, "not_sent"],
        [429, "not_sent"],
        [500, "unknown"],
        [504, "unknown"],
    ] as const)("a %i proves %s", async (status, proof) => {
        const { registrar } = build(() => inetRefused(status))
        const cause = await registrar.renew(RESELLER, { domain: HELD, years: 1 }).then(
            () => null,
            (error: unknown) => error,
        )
        expect(proofOf(cause)).toBe(proof)
    })

    it("a 400 is the answer `rejected` and a 409 the answer `already_exists`: the provider did nothing", async () => {
        const rejected = build(() => inetRefused(400)).registrar
        expect((await refusalOf(rejected.renew(RESELLER, { domain: HELD, years: 1 }))).reason).toBe("rejected")
        const exists = build(() => inetRefused(409)).registrar
        expect((await refusalOf(exists.transfer(RESELLER, { name: "a.vn", authCode: "x", years: 1 }))).reason).toBe("already_exists")
    })

    it("an answer that cannot be read was sent: unknown", async () => {
        const { registrar } = build(() => inetOk({ nothing: true }))
        const cause = await registrar.find(PORTAL, "example.vn").then(
            () => null,
            (error: unknown) => error,
        )
        expect(proofOf(cause)).toBe("unknown")
    })

    it("an account without a key is `not_available` and sends nothing", async () => {
        const { registrar, sent } = build(() => inetOk({}), null)
        expect((await refusalOf(registrar.find(PORTAL, "example.vn"))).reason).toBe("not_available")
        expect(sent).toEqual([])
    })
})
