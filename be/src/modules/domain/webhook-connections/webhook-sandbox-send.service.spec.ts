import { readFileSync } from "node:fs"
import { mock } from "@starci/jest-preset"
import { SandboxCatalogueRegistryService, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { WebhookLiveSendService } from "./webhook-live-send.service"
import { WebhookProviderRegistrationService } from "./webhook-provider-registration.service"
import { WebhookSandboxSendService } from "./webhook-sandbox-send.service"
import { WebhookSendRegistryService } from "./webhook-send-registry.service"
import type { WebhookSendRequest } from "./webhook-send.port"
import { deliveryVerdict } from "./webhook-signing.policy"
import {
    WEBHOOK_CASE,
    WEBHOOK_DELIVER_OPERATION,
    WEBHOOK_SANDBOX_CATALOGUE,
    webhookSandboxEventId,
} from "./webhook-sandbox.catalogue"

const ACCOUNT = sandboxAccount({ id: "wh-sbx", workspaceId: "ws-1", provider: "webhook" })
const CONNECTION = connectionRecord({ id: "wh-sbx", workspaceId: "ws-1", provider: "webhook", sandbox: true })
const LIVE_CONNECTION = connectionRecord({ id: "wh-live", workspaceId: "ws-1", provider: "webhook" })
const REQUEST: WebhookSendRequest = {
    body: '{"id":"c1:evt-1","event":"decision.made"}',
    headers: { "x-nivo-event": "decision.made", "x-nivo-delivery": "c1:evt-1", "x-nivo-signature": "sig" },
}

const setup = () => {
    const { sandbox, store } = sandboxServiceOf(ACCOUNT)
    return { sandbox, store, service: new WebhookSandboxSendService(sandbox) }
}

describe("WebhookSandboxSendService (outgoing cases WEBHOOK-7 .. 12)", () => {
    it("WEBHOOK-7 is the default: the receiver accepts with HTTP 200, and exactly one deliver call is logged with the body and headers", async () => {
        const { sandbox, service } = setup()

        await expect(service.post(CONNECTION, REQUEST)).resolves.toEqual({ status: 200, failure: null, durationMs: 12 })

        const calls = await sandbox.calls(ACCOUNT, WEBHOOK_DELIVER_OPERATION)
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({ key: "c1:evt-1", request: REQUEST, result: { outcome: "answered" } })
    })

    it.each([
        [WEBHOOK_CASE.refused, { status: 400, failure: null }, "refused"],
        [WEBHOOK_CASE.rateLimited, { status: 429, failure: null }, "retry"],
        [WEBHOOK_CASE.serverError, { status: 503, failure: null }, "retry"],
        [WEBHOOK_CASE.noAnswer, { status: null, failure: "timeout" }, "retry"],
        [WEBHOOK_CASE.unreachable, { status: null, failure: "unreachable" }, "retry"],
    ] as const)("%s answers %j and the SAME verdict function reads it as %s", async (caseId, answer, verdict) => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, WEBHOOK_DELIVER_OPERATION, caseId)

        const result = await service.post(CONNECTION, REQUEST)

        expect(result).toMatchObject(answer)
        expect(deliveryVerdict(result.status)).toBe(verdict)
    })

    it("WEBHOOK-7 reads as delivered by the same verdict function", async () => {
        const { service } = setup()

        expect(deliveryVerdict((await service.post(CONNECTION, REQUEST)).status)).toBe("delivered")
    })

    it("the picked case is sticky (a retry sees the same answer) until the account picks the default again", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, WEBHOOK_DELIVER_OPERATION, WEBHOOK_CASE.serverError)

        expect((await service.post(CONNECTION, REQUEST)).status).toBe(503)
        expect((await service.post(CONNECTION, REQUEST)).status).toBe(503)
        await sandbox.setNextCase(ACCOUNT, WEBHOOK_DELIVER_OPERATION, WEBHOOK_CASE.delivered)
        expect((await service.post(CONNECTION, REQUEST)).status).toBe(200)
        expect(await sandbox.calls(ACCOUNT, WEBHOOK_DELIVER_OPERATION)).toHaveLength(3)
    })

    it("the request never picks the case: whatever the delivery says, the picked case answers", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, WEBHOOK_DELIVER_OPERATION, WEBHOOK_CASE.refused)

        for (const id of ["a", "WEBHOOK-7", "ok.vn"]) {
            const result = await service.post(CONNECTION, { body: "{}", headers: { "x-nivo-delivery": id } })
            expect(result.status).toBe(400)
        }
    })

    it("is deterministic: a fresh account answers the same", async () => {
        const first = setup()
        const second = setup()

        await expect(first.service.post(CONNECTION, REQUEST)).resolves.toEqual(await second.service.post(CONNECTION, REQUEST))
    })

    it("refuses a live account and a switched-off sandbox, before anything is answered", async () => {
        const { service } = setup()
        const off = new WebhookSandboxSendService(sandboxServiceOff(ACCOUNT).sandbox)

        await expect(service.post(LIVE_CONNECTION, REQUEST)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(off.post(CONNECTION, REQUEST)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("is the twin the registry answers for a sandbox account; a live account gets the live port and never the sandbox", async () => {
        const { service } = setup()
        const live = mock<WebhookLiveSendService>({ provider: "webhook" })
        const registry = new WebhookSendRegistryService()
        registry.register({ live, sandbox: service })

        expect(registry.portFor(CONNECTION)).toBe(service)
        expect(registry.portFor(LIVE_CONNECTION)).toBe(live)
        await registry.portFor(CONNECTION)?.post(CONNECTION, REQUEST)
        expect(live.post).not.toHaveBeenCalled()
    })

    it("registers its twin and its catalogue at boot", () => {
        const { sandbox, service } = setup()
        const registry = new WebhookSendRegistryService()
        const catalogues = new SandboxCatalogueRegistryService()
        const live = mock<WebhookLiveSendService>({ provider: "webhook" })

        new WebhookProviderRegistrationService(registry, live, service, catalogues).onModuleInit()

        expect(registry.portFor(CONNECTION)).toBe(service)
        expect(registry.portFor(LIVE_CONNECTION)).toBe(live)
        expect(catalogues.casesOf("webhook").map((one) => one.id)).toEqual(WEBHOOK_SANDBOX_CATALOGUE.cases.map((one) => one.id))
        expect(sandbox.enabled()).toBe(true)
    })

    it("has zero network: the sandbox frame only, no delivery client, no address, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        const catalogue = readFileSync(__filename.replace("-send.service.spec.ts", ".catalogue.ts"), "utf8")

        expect(WebhookSandboxSendService.length).toBe(1)
        for (const text of [source, catalogue]) {
            expect(text).not.toContain("@modules/integrations")
            expect(text).not.toContain("http")
            expect(text).not.toContain("readSecret")
            expect(text).not.toContain("Date.now")
        }
    })
})

describe("the webhook catalogue", () => {
    const cases = WEBHOOK_SANDBOX_CATALOGUE.cases

    it("has unique WEBHOOK-<n> ids 1..12, each with a label, for the provider webhook", () => {
        expect(cases.map((one) => one.id)).toEqual(Array.from({ length: 12 }, (_, index) => `WEBHOOK-${String(index + 1)}`))
        expect(cases.every((one) => one.label.length > 0)).toBe(true)
        expect(WEBHOOK_SANDBOX_CATALOGUE.provider).toBe("webhook")
        expect(Object.values(WEBHOOK_CASE)).toEqual(cases.map((one) => one.id))
    })

    it("has six inbound cases (1..6) on the generic door's real route and six outgoing cases (7..12) of `deliver`, exactly one default", () => {
        expect(cases.filter((one) => one.inbound !== undefined).map((one) => one.id)).toEqual(cases.slice(0, 6).map((one) => one.id))
        expect(cases.slice(0, 6).every((one) => one.inbound?.path("abc") === "api/inbound/abc")).toBe(true)
        expect(cases.slice(6).every((one) => one.operation === "deliver" && one.inbound === undefined)).toBe(true)
        expect(cases.filter((one) => one.default === true).map((one) => one.id)).toEqual(["WEBHOOK-7"])
    })

    it("numbers the facts of an account running from its inbound sends", () => {
        expect(webhookSandboxEventId(0)).toBe("sbx-evt-000001")
        expect(webhookSandboxEventId(41)).toBe("sbx-evt-000042")
    })
})
