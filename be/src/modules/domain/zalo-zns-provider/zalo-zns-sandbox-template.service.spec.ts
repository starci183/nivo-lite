import { readFileSync } from "node:fs"
import { ProviderRegistryErrorCode, proofOf } from "@modules/domain/provider-registry"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { ZALO_ZNS_SANDBOX_CATALOGUE } from "./zalo-zns-sandbox.catalogue"
import { ZaloZnsSandboxTemplateService } from "./zalo-zns-sandbox-template.service"

const ACCOUNT = sandboxAccount({ id: "conn-z", workspaceId: "ws-1", provider: "zalo_oa" })
const CONNECTION = connectionRecord({ id: "conn-z", workspaceId: "ws-1", provider: "zalo_oa", sandbox: true })
const request = (templateId: string) => ({ phone: "0900000001", templateId, data: { order: "NIVO-DH1001" }, trackingId: null })

const setup = () => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    return { sandbox, service: new ZaloZnsSandboxTemplateService(sandbox) }
}

/** What a rejected promise threw. */
const thrownOf = (run: Promise<unknown>): Promise<unknown> => run.catch((cause: unknown) => cause)

describe("ZaloZnsSandboxTemplateService", () => {
    it("ZNS-1: sends template 000001 and names a running message id", async () => {
        const { service } = setup()

        expect(await service.sendTemplate(CONNECTION, request("000001"))).toEqual({ messageId: "SBX-ZNS-000001" })
        expect(await service.sendTemplate(CONNECTION, request("000001"))).toEqual({ messageId: "SBX-ZNS-000002" })
    })

    it("ZNS-2: refuses template 000404 and any template the catalogue does not name as not_found, proved not_sent", async () => {
        const { service } = setup()

        for (const templateId of ["000404", "777777"]) {
            const failure = await thrownOf(service.sendTemplate(CONNECTION, request(templateId)))
            expect(failure).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotFound, params: { provider: "zalo_oa", detail: "template not found" } })
            expect(proofOf(failure)).toBe("not_sent")
        }
    })

    it("ZNS-3: refuses template 000429 as a rejected quota, proved not_sent", async () => {
        const { service } = setup()

        const failure = await thrownOf(service.sendTemplate(CONNECTION, request("000429")))

        expect(failure).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected, params: { provider: "zalo_oa", detail: "template quota exceeded" } })
        expect(proofOf(failure)).toBe("not_sent")
    })

    it("logs exactly one call per request, the failing ones as threw", async () => {
        const { sandbox, service } = setup()

        await service.sendTemplate(CONNECTION, request("000001"))
        await thrownOf(service.sendTemplate(CONNECTION, request("000429")))

        const calls = await sandbox.calls(ACCOUNT, "sendTemplate")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({ key: "000001", result: { outcome: "answered" } })
        expect(calls[1]).toMatchObject({ key: "000429", result: { outcome: "threw" } })
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { service } = setup()
        const off = new ZaloZnsSandboxTemplateService(sandboxServiceOff(ACCOUNT).sandbox)

        await expect(service.sendTemplate({ ...CONNECTION, sandbox: false }, request("000001"))).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.LiveAccount,
        })
        await expect(off.sendTemplate(CONNECTION, request("000001"))).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has a catalogue of unique ids ZNS-<n> and zero network: one dependency, no integration import, no http", () => {
        const ids = ZALO_ZNS_SANDBOX_CATALOGUE.cases.map((one) => one.id)
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(ids).toEqual(["ZNS-1", "ZNS-2", "ZNS-3"])
        expect(ZaloZnsSandboxTemplateService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
