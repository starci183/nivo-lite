import { mock } from "@starci/jest-preset"
import type { ConnectionApiTokenService } from "@modules/domain/connection-secrets"
import type { ConnectionRecord, ConnectionsService } from "@modules/domain/connections"
import { InetDomainRegistrarService } from "@modules/domain/inet-provider/inet-domain-registrar.service"
import type { NativeCaller } from "@modules/domain/tools"
import { DomainRegistrarRegistryService } from "@modules/domain/provider-registry"
import { TinoDomainRegistrarService } from "@modules/domain/tino-provider/tino-domain-registrar.service"
import { InetClient } from "@modules/integrations/inet/inet.client"
import { TinoClient } from "@modules/integrations/tino/tino.client"
import type { HttpClient, HttpRequest, HttpResponse } from "@modules/platform/http"
import {
    FAKE_KEY,
    INET_PORTAL_AVAILABLE,
    INET_PORTAL_DOMAIN_DETAIL,
    INET_PORTAL_DOMAIN_PAGE,
    INET_PORTAL_RECORDS,
    TINO_DOMAIN_BY_NAME,
    TINO_DOMAIN_DETAIL,
    TINO_LOOKUP,
    TINO_RENEW,
    inetOk,
    registrarAccountOf,
    tinoOk,
} from "@tests/fixtures/builders/domain-registrars.builder"
import { DOMAIN_TOOL_BUSINESS_REFUSALS } from "@modules/domain/provider-registry"
import { DOMAIN_REFUSAL_CLASS, DOMAIN_TOOL_REFUSALS } from "./domain-refusal.policy"
import { DOMAIN_MANIFEST, DomainToolsService } from "./domain-tools.service"
import { causeParamsOf } from "@tests/fixtures/builders/cause-facts.builder"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const INET_BASE = "https://developers.inet.vn/api/gateway/v1"
const TINO_BASE = "https://api.tino.vn"
const INET_ACCOUNT = registrarAccountOf("c-inet", "inet", { api_context: "portal" })
const TINO_ACCOUNT = registrarAccountOf("c-tino", "tino")
const CALLER: NativeCaller = { agentId: "agent-1", conversationId: null }

/** iNET's Portal answers by route; `holds` decides whether its account holds `example.vn`. */
const inetAnswer = (holds: boolean) => (request: HttpRequest): HttpResponse => {
    if (request.url.includes("/check-available")) return inetOk(INET_PORTAL_AVAILABLE)
    if (request.url.includes("/record")) return inetOk(INET_PORTAL_RECORDS)
    if (request.url.startsWith(`${INET_BASE}/domain?`)) return inetOk(holds ? INET_PORTAL_DOMAIN_PAGE : { ...INET_PORTAL_DOMAIN_PAGE, content: [] })
    return inetOk(INET_PORTAL_DOMAIN_DETAIL)
}

/** Tino's answers by route; `holds` decides whether its account holds `example.com`. */
const tinoAnswer = (holds: boolean) => (request: HttpRequest): HttpResponse => {
    if (request.url.endsWith("/lookup")) return tinoOk(TINO_LOOKUP)
    if (request.url.includes("/name/")) return tinoOk(holds ? TINO_DOMAIN_BY_NAME : { success: true, domains: [] })
    if (request.url.endsWith("/renew")) return tinoOk(TINO_RENEW)
    return tinoOk(TINO_DOMAIN_DETAIL)
}

/** What each fake registrar answers to a request. */
interface RegistrarAnswers {
    readonly inet: (request: HttpRequest) => HttpResponse
    readonly tino: (request: HttpRequest) => HttpResponse
}

const build = (
    accounts: ReadonlyArray<ConnectionRecord>,
    answers: RegistrarAnswers,
) => {
    const sent: Array<HttpRequest> = []
    const httpOf = (answer: (request: HttpRequest) => HttpResponse): HttpClient => {
        const http = mock<HttpClient>()
        http.request.mockImplementation((request: HttpRequest) => {
            sent.push(request)
            return Promise.resolve(answer(request))
        })
        return http
    }
    const tokens = mock<ConnectionApiTokenService>()
    tokens.read.mockResolvedValue(FAKE_KEY)
    const registry = new DomainRegistrarRegistryService()
    registry.register(
        new InetDomainRegistrarService(new InetClient(httpOf(answers.inet), { apiBase: INET_BASE, timeoutMs: 4000 }), tokens),
    )
    registry.register(
        new TinoDomainRegistrarService(new TinoClient(httpOf(answers.tino), { apiBase: TINO_BASE, timeoutMs: 4000 }), tokens),
    )
    const connections = mock<ConnectionsService>()
    connections.list.mockResolvedValue(accounts)
    return { tools: new DomainToolsService(connections, registry), sent }
}

const refusalOf = async (work: Promise<unknown>): Promise<unknown> => {
    const cause = await work.then(
        () => null,
        (error: unknown) => error,
    )
    return causeParamsOf(cause).reason
}

/** Both registrars, each with its account, the name its fixture holds, and its fixture's facts. */
const REGISTRARS = [
    {
        provider: "inet",
        account: INET_ACCOUNT,
        name: "example.vn",
        free: "mywebsite.vn",
        expiresOn: "01/01/2027",
        nameservers: ["ns1.inet.vn", "ns2.inet.vn"],
    },
    {
        provider: "tino",
        account: TINO_ACCOUNT,
        name: "example.com",
        free: "example.com",
        expiresOn: "2026-12-07",
        nameservers: ["ns1.tino.vn", "ns2.tino.vn"],
    },
] as const

describe("the domain tools serve ONE contract over every registrar", () => {
    it.each(REGISTRARS)("$provider: availability.get answers provider, name, available, prices", async (registrar) => {
        const { tools } = build([registrar.account], { inet: inetAnswer(true), tino: tinoAnswer(true) })
        const answer = await tools.invoke("ws-1", "availability.get", { name: registrar.free }, CALLER)
        expect(Object.keys(answer).sort()).toEqual(["available", "name", "prices", "provider"])
        expect(answer).toMatchObject({ provider: registrar.provider, available: true })
    })

    it.each(REGISTRARS)("$provider: get answers the held domain's facts in the same members", async (registrar) => {
        const { tools } = build([registrar.account], { inet: inetAnswer(true), tino: tinoAnswer(true) })
        const answer = await tools.invoke("ws-1", "get", { name: registrar.name }, CALLER)
        expect(Object.keys(answer).sort()).toEqual(["autoRenew", "expiresOn", "name", "nameservers", "provider", "status"])
        expect(answer).toMatchObject({
            provider: registrar.provider,
            name: registrar.name,
            expiresOn: registrar.expiresOn,
            nameservers: registrar.nameservers,
        })
    })

    it.each(REGISTRARS)("$provider: dns.record.list answers records or the provider's answer, in the same members", async (registrar) => {
        const { tools } = build([registrar.account], { inet: inetAnswer(true), tino: tinoAnswer(true) })
        const answer = await tools.invoke("ws-1", "dns.record.list", { name: registrar.name }, CALLER)
        expect(Object.keys(answer).sort()).toEqual(["name", "providerData", "provider", "records"].sort())
    })

    it.each(REGISTRARS)("$provider: a name no account holds is the business answer domain_not_held", async (registrar) => {
        const { tools } = build([registrar.account], { inet: inetAnswer(false), tino: tinoAnswer(false) })
        await expect(refusalOf(tools.invoke("ws-1", "renewal.create", { name: registrar.name, years: 1 }, CALLER))).resolves.toBe(
            "domain_not_held",
        )
    })
})

describe("the account of a domain operation (by data first)", () => {
    it("renews a domain held at account A through A, even when the tool runner handed B first", async () => {
        // B (iNET) is handed and holds nothing; A (Tino) holds example.com.
        const { tools, sent } = build([INET_ACCOUNT, TINO_ACCOUNT], { inet: inetAnswer(false), tino: tinoAnswer(true) })

        const answer = await tools.invoke("ws-1", "renewal.create", { name: "example.com", years: 1 }, {
            ...CALLER,
            connectionId: INET_ACCOUNT.id,
            provider: "inet",
        })

        expect(answer).toMatchObject({ provider: "tino", name: "example.com", reference: "1201939", total: 588109 })
        expect(sent.filter((request) => request.url.endsWith("/renew")).map((request) => request.url)).toEqual([
            `${TINO_BASE}/v1/domain/200001/renew`,
        ])
    })

    it("asks the handed account first, so a domain both could hold is acted on through the handed one", async () => {
        const { tools, sent } = build([TINO_ACCOUNT, INET_ACCOUNT], { inet: inetAnswer(true), tino: tinoAnswer(true) })
        await tools.invoke("ws-1", "get", { name: "example.vn" }, { ...CALLER, connectionId: INET_ACCOUNT.id })
        expect(sent[0]?.url.startsWith(INET_BASE)).toBe(true)
    })

    it("takes a name not held through the handed account, the only account, or refuses the choice", async () => {
        const one = build([TINO_ACCOUNT], { inet: inetAnswer(true), tino: tinoAnswer(true) })
        await expect(one.tools.invoke("ws-1", "availability.get", { name: "example.com" }, CALLER)).resolves.toMatchObject({
            provider: "tino",
        })
        const two = build([INET_ACCOUNT, TINO_ACCOUNT], { inet: inetAnswer(true), tino: tinoAnswer(true) })
        await expect(refusalOf(two.tools.invoke("ws-1", "availability.get", { name: "a.vn" }, CALLER))).resolves.toBe("not_selected")
        await expect(
            two.tools.invoke("ws-1", "availability.get", { name: "mywebsite.vn" }, { ...CALLER, connectionId: INET_ACCOUNT.id }),
        ).resolves.toMatchObject({ provider: "inet" })
        const none = build([], { inet: inetAnswer(true), tino: tinoAnswer(true) })
        await expect(refusalOf(none.tools.invoke("ws-1", "get", { name: "a.vn" }, CALLER))).resolves.toBe("not_connected")
    })

    it("passes over a disconnected account and an account of a provider no registrar serves", async () => {
        const gone = { ...TINO_ACCOUNT, status: "disconnected" as const }
        const bank = registrarAccountOf("c-bank", "sepay")
        const { tools } = build([gone, bank], { inet: inetAnswer(true), tino: tinoAnswer(true) })
        await expect(refusalOf(tools.invoke("ws-1", "get", { name: "example.com" }, CALLER))).resolves.toBe("not_connected")
    })

    it("hands on the adapter's refusal as the tool's answer (iNET Portal cannot register)", async () => {
        const { tools } = build([INET_ACCOUNT], { inet: inetAnswer(true), tino: tinoAnswer(true) })
        const call = tools.invoke("ws-1", "registration.create", { name: "new.vn", years: 1 }, CALLER)
        await expect(refusalOf(call)).resolves.toBe("not_available")
    })
})

describe("the domain tools' manifest and schemas", () => {
    const toolOf = (name: string) => {
        const found = DOMAIN_MANIFEST.tools.find((tool) => tool.name === name)
        if (found === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: name } })
        return found
    }

    it("serves every purpose under nivo.tool.domain, internal only, writes asked first", () => {
        expect(DOMAIN_MANIFEST.tools.map((tool) => tool.domain)).toEqual([
            "nivo.tool.domain.availability.get",
            "nivo.tool.domain.get",
            "nivo.tool.domain.list",
            "nivo.tool.domain.registration.create",
            "nivo.tool.domain.renewal.create",
            "nivo.tool.domain.transfer.create",
            "nivo.tool.domain.dns.record.list",
            "nivo.tool.domain.dns.record.create",
            "nivo.tool.domain.dns.record.update",
            "nivo.tool.domain.dns.record.delete",
            "nivo.tool.domain.nameserver.update",
        ])
        expect(DOMAIN_MANIFEST.tools.every((tool) => tool.internalOnly === true)).toBe(true)
        expect(DOMAIN_MANIFEST.tools.filter((tool) => tool.scope === "write").every((tool) => tool.defaultMode === "ask")).toBe(true)
    })

    it.each([
        ["registration.create", { name: "a.vn", years: 0 }],
        ["registration.create", { name: "a.vn", years: 11 }],
        ["registration.create", { name: "a.vn", years: 1, nameservers: ["ns1.inet.vn"] }],
        ["registration.create", { name: "a.vn", years: 1, nameservers: ["a.vn", "b.vn", "c.vn", "d.vn", "e.vn"] }],
        ["nameserver.update", { name: "a.vn", nameservers: ["ns1.inet.vn"] }],
        ["dns.record.create", { name: "a.vn", record: { name: "@", type: "A", value: "" } }],
        ["dns.record.create", { name: "a.vn", record: { name: "@", type: "MX", value: "mx.a.vn", priority: 70_000 } }],
        ["renewal.create", { name: "a.vn", years: 1, extra: true }],
        ["get", { name: "" }],
    ])("%s refuses %j (the bounds every registrar shares)", (tool, args) => {
        expect(toolOf(tool).argumentSchema.safeParse(args).success).toBe(false)
    })

    it("accepts a record with its ttl and priority defaulted to null", () => {
        const parsed = toolOf("dns.record.create").argumentSchema.safeParse({ name: "a.vn", record: { name: "@", type: "A", value: "1.2.3.4" } })
        expect(parsed).toMatchObject({ success: true, data: { record: { ttl: null, priority: null } } })
    })

    it("masks the contacts and the transfer code in the audit", () => {
        expect(toolOf("registration.create").secretFields).toEqual(["contacts", "authCode"])
        expect(toolOf("transfer.create").secretFields).toEqual(["contacts", "authCode"])
    })

    it("classes every refusal, closed", () => {
        expect(DOMAIN_TOOL_REFUSALS).toEqual(Object.keys(DOMAIN_REFUSAL_CLASS))
        expect(DOMAIN_REFUSAL_CLASS.domain_not_held).toBe("business")
        expect(DOMAIN_REFUSAL_CLASS.not_available).toBe("infrastructure")
        // The engine's tool registry lists exactly the business ones (the others freeze the step).
        expect([...DOMAIN_TOOL_BUSINESS_REFUSALS]).toEqual(
            Object.entries(DOMAIN_REFUSAL_CLASS).filter(([, kind]) => kind === "business").map(([reason]) => reason),
        )
    })
})
