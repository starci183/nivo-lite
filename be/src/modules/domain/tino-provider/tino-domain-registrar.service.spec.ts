import { mock } from "@starci/jest-preset"
import type { ConnectionApiTokenService } from "@modules/domain/connection-secrets"
import { proofOf, ProviderRegistryError, ProviderRegistryErrorCode, registrarRefusalReason } from "@modules/domain/provider-registry"
import type { DomainRefusalReason } from "@modules/domain/provider-registry"
import type { DomainRecord } from "@modules/domain/provider-registry"
import { TinoClient } from "@modules/integrations/tino/tino.client"
import type { HttpClient, HttpRequest } from "@modules/platform/http"
import {
    FAKE_KEY,
    TINO_DOMAIN_BY_NAME,
    TINO_DOMAIN_LIST,
    TINO_LOOKUP,
    TINO_NS_SAVED,
    TINO_RENEW,
    TINO_ROUTE_REFUSED,
    registrarAccountOf,
    tinoGatewayRefused,
    tinoOk,
} from "@tests/fixtures/builders/domain-registrars.builder"
import { TinoDomainRegistrarService } from "./tino-domain-registrar.service"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const BASE = "https://api.tino.vn"
const ACCOUNT = registrarAccountOf("c-tino", "tino")
const HELD: DomainRecord = {
    name: "example.com",
    providerId: "200001",
    status: "Active",
    expiresOn: "2026-12-07",
    nameservers: null,
    autoRenew: true,
}

/** What the fake Tino API answers: a status and a body. */
interface HttpAnswer {
    readonly status: number
    readonly body: unknown
}

const build = (answer: (request: HttpRequest) => HttpAnswer, key: string | null = FAKE_KEY) => {
    const http = mock<HttpClient>()
    const sent: Array<HttpRequest> = []
    http.request.mockImplementation((request: HttpRequest) => {
        sent.push(request)
        return Promise.resolve(answer(request))
    })
    const tokens = mock<ConnectionApiTokenService>()
    tokens.read.mockResolvedValue(key)
    const client = new TinoClient(http, { apiBase: BASE, timeoutMs: 4000 })
    return { registrar: new TinoDomainRegistrarService(client, tokens), sent }
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

describe("TinoDomainRegistrarService", () => {
    it("answers availability with the lookup's prices per period", async () => {
        const { registrar } = build(() => tinoOk(TINO_LOOKUP))
        await expect(registrar.availability(ACCOUNT, "example.com")).resolves.toEqual({
            name: "example.com",
            available: true,
            prices: [
                { years: 1, register: 319000, renew: 399000, transfer: 399000 },
                { years: 2, register: 638000, renew: 798000, transfer: 798000 },
            ],
        })
    })

    it("finds a held domain by name, and reads a route's refusal of it as not held", async () => {
        await expect(build(() => tinoOk(TINO_DOMAIN_BY_NAME)).registrar.find(ACCOUNT, "example.com")).resolves.toEqual({
            ...HELD,
            nameservers: ["ns1.tino.vn", "ns2.tino.vn"],
        })
        await expect(build(() => TINO_ROUTE_REFUSED).registrar.find(ACCOUNT, "other.com")).resolves.toBeNull()
    })

    it("lists with Tino's 0-based page", async () => {
        const { registrar, sent } = build(() => tinoOk(TINO_DOMAIN_LIST))
        const page = await registrar.list(ACCOUNT, { page: 1, pageSize: 20 })
        expect(sent[0]?.url).toBe(`${BASE}/v1/domain?page=0&perpage=20`)
        expect(page).toMatchObject({ page: 1, totalPages: null, domains: [{ name: "example.com", providerId: "200001" }] })
    })

    it("registers: looks the name up first, then orders it with the lookup's tld id", async () => {
        const { registrar, sent } = build((request) => tinoOk(request.url.endsWith("/lookup") ? TINO_LOOKUP : { success: true }))

        const receipt = await registrar.register(ACCOUNT, {
            name: "example.com",
            years: 1,
            nameservers: ["ns1.tino.vn", "ns2.tino.vn"],
            contacts: [],
        })

        expect(sent.map((request) => [request.method, request.url, request.body])).toEqual([
            ["POST", `${BASE}/v1/domain/lookup`, { name: "example.com" }],
            [
                "POST",
                `${BASE}/v1/domain/order`,
                { name: "example.com", years: "1", action: "register", tld_id: "346", nameservers: ["ns1.tino.vn", "ns2.tino.vn"] },
            ],
        ])
        expect(receipt).toEqual({ name: "example.com", reference: null, total: null, providerData: { success: true } })
    })

    it("refuses a registration with contact data (Tino takes saved contact ids) and one of a name not free", async () => {
        const contact = {
            role: "registrant" as const,
            fullName: "A",
            organization: false,
            email: "a@example.com",
            phone: "0900000000",
            country: "VN",
            province: "HCM",
            address: "1",
            ward: "1",
        }
        const { registrar, sent } = build(() => tinoOk({ ...TINO_LOOKUP, avaliable: false }))
        const request = { name: "example.com", years: 1, nameservers: [], contacts: [contact] }
        expect((await refusalOf(registrar.register(ACCOUNT, request))).reason).toBe("contacts_unsupported")
        expect(sent).toEqual([])
        expect((await refusalOf(registrar.register(ACCOUNT, { ...request, contacts: [] }))).providerCode).toBe("not free")
        expect(sent.map((asked) => asked.url)).toEqual([`${BASE}/v1/domain/lookup`])
    })

    it("transfers by an order of action transfer carrying the code as `epp`", async () => {
        const { registrar, sent } = build((request) => tinoOk(request.url.endsWith("/lookup") ? TINO_LOOKUP : {}))
        await registrar.transfer(ACCOUNT, { name: "example.com", authCode: "auth", years: 1 })
        expect(sent[1]?.body).toEqual({ name: "example.com", years: "1", action: "transfer", tld_id: "346", epp: "auth" })
    })

    it("renews and reads the invoice and the total", async () => {
        const { registrar, sent } = build(() => tinoOk(TINO_RENEW))
        const receipt = await registrar.renew(ACCOUNT, { domain: HELD, years: 1 })
        expect(sent[0]).toMatchObject({ method: "POST", url: `${BASE}/v1/domain/200001/renew`, body: { years: "1" } })
        expect(receipt).toMatchObject({ name: "example.com", reference: "1201939", total: 588109 })
    })

    it("writes DNS by the documented members (content, priority as text), refuses a ttl it does not document", async () => {
        const { registrar, sent } = build(() => tinoOk({}))
        const mx = { name: "@", type: "MX", value: "mx.example.com", ttl: null, priority: 10 }
        await registrar.createDnsRecord(ACCOUNT, HELD, mx)
        await registrar.updateDnsRecord(ACCOUNT, HELD, "3", mx)
        await registrar.deleteDnsRecord(ACCOUNT, HELD, "3")
        expect(sent.map((request) => [request.method, request.url, request.body])).toEqual([
            ["POST", `${BASE}/v1/domain/200001/dns`, { name: "@", type: "MX", priority: "10", content: "mx.example.com" }],
            ["PUT", `${BASE}/v1/domain/200001/dns/3`, { record_id: 3, name: "@", type: "MX", priority: "10", content: "mx.example.com" }],
            ["DELETE", `${BASE}/v1/domain/200001/dns/3?record_id=3`, undefined],
        ])
        expect((await refusalOf(registrar.createDnsRecord(ACCOUNT, HELD, { ...mx, ttl: 300 }))).providerCode).toBe("ttl not taken")
    })

    it("keeps the record list as it came (no example published) and saves nameservers", async () => {
        const { registrar } = build((request) => tinoOk(request.url.endsWith("/ns") ? TINO_NS_SAVED : { records: "as given" }))
        await expect(registrar.dnsRecords(ACCOUNT, HELD)).resolves.toEqual({ kind: "undocumented", providerData: { records: "as given" } })
        await expect(registrar.updateNameservers(ACCOUNT, HELD, ["ns1.tino.vn", "ns2.tino.vn"])).resolves.toEqual({
            name: "example.com",
            records: null,
            providerData: TINO_NS_SAVED,
        })
    })

    it("a gateway refusal proves not_sent, a 5xx unknown, a route's refusal is the answer `rejected`", async () => {
        const failure = (answer: HttpAnswer): Promise<unknown> =>
            build(() => answer).registrar.renew(ACCOUNT, { domain: HELD, years: 1 }).then(
                () => null,
                (error: unknown) => error,
            )
        expect(proofOf(await failure(tinoGatewayRefused(401, "invalid_token")))).toBe("not_sent")
        expect(proofOf(await failure(tinoGatewayRefused(403, "insufficient_scope")))).toBe("not_sent")
        expect(proofOf(await failure({ status: 503, body: {} }))).toBe("unknown")
        const rejected = await failure(TINO_ROUTE_REFUSED)
        expect(registrarRefusalReason(rejected)).toBe("rejected")
        expect(rejected).toMatchObject({ code: ProviderRegistryErrorCode.DomainRejected, params: { providerCode: "route_refusal_code" } })
    })

    it("an account without a token is `not_available` and sends nothing", async () => {
        const { registrar, sent } = build(() => tinoOk({}), null)
        expect((await refusalOf(registrar.availability(ACCOUNT, "example.com"))).reason).toBe("not_available")
        expect(sent).toEqual([])
    })
})
