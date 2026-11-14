import { mock } from "@starci/jest-preset"
import type { ConnectionRecord, ConnectionsService } from "@modules/domain/connections"
import { InetSandboxRegistrarService } from "@modules/domain/inet-provider/inet-sandbox-registrar.service"
import { INET_CASE, INET_SANDBOX_RENEWAL_PRICE } from "@modules/domain/inet-provider/inet-sandbox.catalogue"
import {
    DomainRegistrarRegistryService,
    proofOf,
    registrarRefusal,
    type DomainRecord,
    type DomainRegistrarPort,
} from "@modules/domain/provider-registry"
import type { NativeCaller } from "@modules/domain/tools"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { causeParamsOf } from "@tests/fixtures/builders/cause-facts.builder"
import { sandboxAccount, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { DOMAIN_MANIFEST, DomainToolsService } from "./domain-tools.service"
import { PENDING, RENEWED, renewalOutcomeOf, serviceRenewalOutcomeOf } from "./renewal-outcome.policy"

/**
 * The renewal a graph branches on (owner ruling R57: the Renewal agent renews AT THE PROVIDER on its attached account; the customer is
 * told "renewed" only when the provider really renewed): `renewed` (new end date + order reference), `pending` (order reference, effect
 * not proved yet; checked later by `renewal.get`), a typed refusal (nothing renewed), or a failure whose outcome is unknown (the step stops;
 * the tool is not repeatable). Run on the REAL iNET sandbox implementation (the one switch picks it by the account's flag) and, for the
 * shapes no sandbox case gives yet, on a port written here.
 */
const ACCOUNT = sandboxAccount({ id: "sbx-inet", workspaceId: "ws-1", provider: "inet" })
const SANDBOX_INET: ConnectionRecord = connectionRecord({
    id: "sbx-inet",
    workspaceId: "ws-1",
    provider: "inet",
    name: "iNET Sandbox",
    sandbox: true,
    meta: { api_context: "reseller" },
})
const CALLER: NativeCaller = { agentId: "agent-renew", conversationId: null }

/** A live iNET port that must never be reached by the sandbox account. */
const liveNeverReached = (): DomainRegistrarPort => mock<DomainRegistrarPort>({ provider: "inet" })

const sandboxBuild = () => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    const registry = new DomainRegistrarRegistryService()
    const live = liveNeverReached()
    registry.register({ live, sandbox: new InetSandboxRegistrarService(sandbox) })
    const connections = mock<ConnectionsService>()
    connections.list.mockResolvedValue([SANDBOX_INET])
    const pick = (caseId: string): Promise<void> => sandbox.setNextCase(ACCOUNT, "renew", caseId)
    return { tools: new DomainToolsService(connections, registry), sandbox, live, pick }
}

/** A held domain as a port written here states it. */
const heldDomain = (expiresOn: string | null): DomainRecord => ({
    name: "shop.vn",
    providerId: "d-1",
    status: "active",
    expiresOn,
    nameservers: null,
    autoRenew: null,
})

/** A registrar port of a live account (provider `tino`), each purpose a jest function the case sets. */
const portBuild = (port: Partial<DomainRegistrarPort>) => {
    const registry = new DomainRegistrarRegistryService()
    const full = mock<DomainRegistrarPort>({ provider: "tino", ...port })
    registry.register(full)
    const connections = mock<ConnectionsService>()
    connections.list.mockResolvedValue([connectionRecord({ id: "c-tino", provider: "tino", name: "Tino" })])
    return { tools: new DomainToolsService(connections, registry), port: full }
}

/** What a rejected call threw. */
const thrownOf = (work: Promise<unknown>): Promise<unknown> => work.then(() => null, (cause: unknown) => cause)

describe("the renewal outcome (the provider's own expiry proves it)", () => {
    it("is renewed only when both expiries are stated and differ; pending otherwise", () => {
        expect(renewalOutcomeOf("2026-12-14", "2027-12-14")).toBe(RENEWED)
        expect(renewalOutcomeOf("2026-12-14", "2026-12-14")).toBe(PENDING)
        expect(renewalOutcomeOf(null, "2027-12-14")).toBe(PENDING)
        expect(renewalOutcomeOf("2026-12-14", null)).toBe(PENDING)
        expect(serviceRenewalOutcomeOf("2027-01-01")).toBe(RENEWED)
        expect(serviceRenewalOutcomeOf(null)).toBe(PENDING)
    })
})

describe("nivo.tool.domain.renewal.create on an iNET SANDBOX account", () => {
    it("RENEWED: answers the order, outcome renewed, the old and the new end date; the live port is never reached", async () => {
        const { tools, live } = sandboxBuild()

        const answer = await tools.invoke("ws-1", "renewal.create", { name: "a.vn", years: 1 }, CALLER)

        expect(answer).toEqual({
            provider: "inet",
            name: "a.vn",
            reference: "SBX-INET-000001",
            total: INET_SANDBOX_RENEWAL_PRICE,
            providerData: { sandbox: true, period: 1, expiresOn: "2027-12-14" },
            service: "domain",
            outcome: "renewed",
            expiresBefore: "2026-12-14",
            expiresOn: "2027-12-14",
        })
        expect(jest.mocked(live.renew)).not.toHaveBeenCalled()
        expect(jest.mocked(live.find)).not.toHaveBeenCalled()
    })

    it("REFUSED: the balance case is the typed insufficient_balance refusal, nothing renewed (the expiry does not move)", async () => {
        const { tools, pick } = sandboxBuild()
        await pick(INET_CASE.insufficientBalance)

        const thrown = await thrownOf(tools.invoke("ws-1", "renewal.create", { name: "a.vn", years: 1 }, CALLER))

        expect(causeParamsOf(thrown)).toMatchObject({ reason: "insufficient_balance", refusalClass: "business" })
        await expect(tools.invoke("ws-1", "get", { name: "a.vn" }, CALLER)).resolves.toMatchObject({ expiresOn: "2026-12-14" })
    })

    it("REFUSED: the locked case is the typed domain_locked refusal, nothing renewed", async () => {
        const { tools, pick } = sandboxBuild()
        await pick(INET_CASE.locked)

        const thrown = await thrownOf(tools.invoke("ws-1", "renewal.create", { name: "a.vn", years: 1 }, CALLER))

        expect(causeParamsOf(thrown)).toMatchObject({ reason: "domain_locked", refusalClass: "business" })
        await expect(tools.invoke("ws-1", "get", { name: "a.vn" }, CALLER)).resolves.toMatchObject({ expiresOn: "2026-12-14" })
    })

    it("PENDING (sandbox INET-3): the renewal's own proof read still sees the old expiry so it answers pending; renewal.get later finds it renewed", async () => {
        const { tools, pick } = sandboxBuild()
        await pick(INET_CASE.pending)

        await expect(tools.invoke("ws-1", "renewal.create", { name: "a.vn", years: 1 }, CALLER)).resolves.toMatchObject({
            reference: "SBX-INET-000001",
            outcome: "pending",
            expiresBefore: "2026-12-14",
            expiresOn: "2026-12-14",
        })
        await expect(
            tools.invoke("ws-1", "renewal.get", { name: "a.vn", expiresBefore: "2026-12-14", reference: "SBX-INET-000001" }, CALLER),
        ).resolves.toMatchObject({ outcome: "renewed", expiresOn: "2027-12-14" })
    })

    it("UNKNOWN: an applied renewal whose answer timed out stays a failure proving `unknown` (stop for a person, never sent again)", async () => {
        const { tools, pick } = sandboxBuild()
        await pick(INET_CASE.appliedTimedOut)

        const thrown = await thrownOf(tools.invoke("ws-1", "renewal.create", { name: "a.vn", years: 1 }, CALLER))

        expect(proofOf(thrown)).toBe("unknown")
        expect(causeParamsOf(thrown).refusalClass).toBeUndefined()
    })

    it("NOT SENT: a key refused at the gateway proves `not_sent` (the runner may go on to another account)", async () => {
        const { tools, pick } = sandboxBuild()
        await pick(INET_CASE.auth)

        expect(proofOf(await thrownOf(tools.invoke("ws-1", "renewal.create", { name: "a.vn", years: 1 }, CALLER)))).toBe("not_sent")
    })

    it("a name the account does not hold is the business refusal domain_not_held (nothing asked of the provider)", async () => {
        const { tools } = sandboxBuild()

        const thrown = await thrownOf(tools.invoke("ws-1", "renewal.create", { name: "other.vn", years: 1 }, CALLER))

        expect(causeParamsOf(thrown)).toMatchObject({ reason: "domain_not_held", refusalClass: "business" })
    })

    it("CHECK: renewal.get answers renewed against the expiry before the renewal, pending against the current one", async () => {
        const { tools } = sandboxBuild()
        await tools.invoke("ws-1", "renewal.create", { name: "a.vn", years: 1 }, CALLER)

        await expect(
            tools.invoke("ws-1", "renewal.get", { name: "a.vn", expiresBefore: "2026-12-14", reference: "SBX-INET-000001" }, CALLER),
        ).resolves.toEqual({
            provider: "inet",
            name: "a.vn",
            reference: "SBX-INET-000001",
            outcome: "renewed",
            expiresBefore: "2026-12-14",
            expiresOn: "2027-12-14",
        })
        await expect(
            tools.invoke("ws-1", "renewal.get", { name: "a.vn", expiresBefore: "2027-12-14" }, CALLER),
        ).resolves.toMatchObject({ outcome: "pending", reference: null })
    })

    it("SERVICE: a hosting renewal on a registrar that implements no service renewal is refused not_available (setup), nothing tried", async () => {
        const { tools, sandbox } = sandboxBuild()

        const thrown = await thrownOf(tools.invoke("ws-1", "renewal.create", { name: "a.vn", years: 1, service: "hosting" }, CALLER))

        expect(causeParamsOf(thrown)).toMatchObject({ reason: "not_available", refusalClass: "infrastructure" })
        expect(await sandbox.calls(ACCOUNT, "renew")).toHaveLength(0)
    })
})

describe("nivo.tool.domain.renewal.create on a registrar port (shapes no sandbox case gives)", () => {
    it("PENDING: the order is accepted and the expiry has not moved: outcome pending with the order reference", async () => {
        const { tools } = portBuild({
            find: jest.fn().mockResolvedValue(heldDomain("2026-12-01")),
            renew: jest.fn().mockResolvedValue({ name: "shop.vn", reference: "ORD-7", total: 300_000, providerData: null }),
            details: jest.fn().mockResolvedValue(heldDomain("2026-12-01")),
        })

        await expect(tools.invoke("ws-1", "renewal.create", { name: "shop.vn", years: 1 }, CALLER)).resolves.toEqual({
            provider: "tino",
            name: "shop.vn",
            reference: "ORD-7",
            total: 300_000,
            providerData: null,
            service: "domain",
            outcome: "pending",
            expiresBefore: "2026-12-01",
            expiresOn: "2026-12-01",
        })
    })

    it("a failed read after the charge never throws: pending, the order kept; a held domain stating no expiry is read before", async () => {
        const details = jest.fn().mockResolvedValueOnce(heldDomain("2026-12-01")).mockRejectedValueOnce(new Error("read lost"))
        const { tools } = portBuild({
            find: jest.fn().mockResolvedValue(heldDomain(null)),
            renew: jest.fn().mockResolvedValue({ name: "shop.vn", reference: "ORD-8", total: null, providerData: null }),
            details,
        })

        await expect(tools.invoke("ws-1", "renewal.create", { name: "shop.vn", years: 1 }, CALLER)).resolves.toMatchObject({
            reference: "ORD-8",
            outcome: "pending",
            expiresBefore: "2026-12-01",
            expiresOn: null,
        })
        expect(details).toHaveBeenCalledTimes(2)
    })

    it.each(["insufficient_balance", "domain_locked", "already_exists", "rejected"] as const)(
        "REFUSED: the provider's typed refusal %s is the business refusal a node branches on",
        async (reason) => {
            const { tools } = portBuild({
                find: jest.fn().mockResolvedValue(heldDomain("2026-12-01")),
                renew: jest.fn().mockRejectedValue(registrarRefusal(reason, "provider_code")),
            })

            const thrown = await thrownOf(tools.invoke("ws-1", "renewal.create", { name: "shop.vn", years: 1 }, CALLER))

            expect(causeParamsOf(thrown)).toMatchObject({ reason, refusalClass: "business" })
        },
    )

    it("SERVICE: a provider that renews hosting answers renewed with the end date it states, pending when it states none", async () => {
        const renewService = jest
            .fn()
            .mockResolvedValueOnce({ name: "shop.vn", reference: "H-1", total: 900_000, providerData: null, expiresOn: "2027-11-14" })
            .mockResolvedValueOnce({ name: "shop.vn", reference: "H-2", total: 900_000, providerData: null, expiresOn: null })
        const { tools } = portBuild({ renewService })

        await expect(
            tools.invoke("ws-1", "renewal.create", { name: "shop.vn", years: 1, service: "hosting" }, CALLER),
        ).resolves.toMatchObject({ service: "hosting", reference: "H-1", outcome: "renewed", expiresBefore: null, expiresOn: "2027-11-14" })
        await expect(
            tools.invoke("ws-1", "renewal.create", { name: "shop.vn", years: 1, service: "ssl" }, CALLER),
        ).resolves.toMatchObject({ service: "ssl", reference: "H-2", outcome: "pending" })
        expect(renewService.mock.calls.map(([, request]: [unknown, unknown]) => request)).toEqual([
            { service: "hosting", name: "shop.vn", years: 1 },
            { service: "ssl", name: "shop.vn", years: 1 },
        ])
    })
})

describe("the renewal tools' manifest", () => {
    const toolOf = (name: string) => DOMAIN_MANIFEST.tools.find((tool) => tool.name === name)

    it("renewal.create is a write asked by default; renewal.get is a read run on its own", () => {
        expect(toolOf("renewal.create")).toMatchObject({ scope: "write", defaultMode: "ask", domain: "nivo.tool.domain.renewal.create" })
        expect(toolOf("renewal.get")).toMatchObject({ scope: "read", defaultMode: "auto", domain: "nivo.tool.domain.renewal.get" })
    })

    it.each([
        ["renewal.create", { name: "a.vn", years: 1, service: "vps" }],
        ["renewal.get", { name: "a.vn" }],
        ["renewal.get", { name: "a.vn", expiresBefore: "" }],
        ["renewal.get", { name: "a.vn", expiresBefore: "2026-12-14", extra: true }],
    ])("%s refuses %j", (name, args) => {
        expect(toolOf(name)?.argumentSchema.safeParse(args).success).toBe(false)
    })
})
