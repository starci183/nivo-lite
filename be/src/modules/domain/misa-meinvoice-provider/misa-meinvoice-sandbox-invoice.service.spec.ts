import * as fs from "node:fs"
import type { ConnectionRecord } from "@modules/domain/connections"
import { proofOf, ProviderRegistryErrorCode, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { MISA_MEINVOICE_PROVIDER } from "./misa-meinvoice-invoice.service"
import { MisaMeinvoiceSandboxInvoiceService } from "./misa-meinvoice-sandbox-invoice.service"

const ACCOUNT = sandboxAccount({ id: "conn-m", workspaceId: "ws-1", provider: MISA_MEINVOICE_PROVIDER })
/** The sandbox connection as the engine hands it: a stored connection plus its creation-time `sandbox` flag (lands on `ConnectionRecord` after RESTART-R4). */
const CONNECTION: ConnectionRecord = {
    ...connectionRecord({ id: "conn-m", workspaceId: "ws-1", provider: MISA_MEINVOICE_PROVIDER, meta: {} }),
    sandbox: true,
} as ConnectionRecord
const REQUEST = { draftId: "d-1", renewalId: "r-1" }

/** The sandbox invoice service over a memory store that knows the sandbox account. */
const setup = () => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    return { sandbox, service: new MisaMeinvoiceSandboxInvoiceService(sandbox) }
}

/** What a rejected promise threw. */
const thrownOf = (run: Promise<unknown>): Promise<unknown> => run.catch((cause: unknown) => cause)

describe("MisaMeinvoiceSandboxInvoiceService", () => {
    it("is the issue port of the MISA meInvoice provider key", () => {
        expect(setup().service.provider).toBe("misa_meinvoice")
    })

    it("issues a deterministic invoice by default and logs exactly one issue call with the request", async () => {
        const { sandbox, service } = setup()

        const invoice = await service.issue(CONNECTION, REQUEST)

        expect(invoice).toMatchObject({ id: "sbx-inv-d-1", state: "issued" })
        expect(invoice.invoiceNo).toMatch(/^SBX\d{7}$/)
        const calls = await sandbox.calls(ACCOUNT)
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({
            operation: "issue",
            key: "d-1",
            request: REQUEST,
            result: { outcome: "answered", by: "default", value: invoice },
        })
    })

    it("numbers the same draft the same and another draft differently", async () => {
        const { service } = setup()

        const first = await service.issue(CONNECTION, REQUEST)
        const again = await service.issue(CONNECTION, REQUEST)
        const other = await service.issue(CONNECTION, { draftId: "d-2", renewalId: null })

        expect(again).toEqual(first)
        expect(other.invoiceNo).not.toBe(first.invoiceNo)
    })

    it("answers the fixture kept for the draft before the default", async () => {
        const { sandbox, service } = setup()
        await sandbox.fixture(ACCOUNT, { operation: "issue", key: "d-1", value: { id: "inv-9", state: "issued", invoiceNo: "00000042" } })

        await expect(service.issue(CONNECTION, REQUEST)).resolves.toEqual({ id: "inv-9", state: "issued", invoiceNo: "00000042" })
        await expect(service.issue(CONNECTION, { draftId: "d-2", renewalId: null })).resolves.toMatchObject({ id: "sbx-inv-d-2" })
    })

    it("refuses a malformed fixture as rejected, proved not_sent, and logs the call as thrown", async () => {
        const { sandbox, service } = setup()
        await sandbox.fixture(ACCOUNT, { operation: "issue", value: { state: 5 } })

        const thrown = await thrownOf(service.issue(CONNECTION, REQUEST))

        expect(providerRefusalReason(thrown)).toBe("rejected")
        expect(proofOf(thrown)).toBe("not_sent")
        expect((await sandbox.calls(ACCOUNT))[0]?.result.outcome).toBe("threw")
    })

    it("fails a scripted refusal as the live refusal rejected, with the reason word, and logs a failed call", async () => {
        const { sandbox, service } = setup()
        await sandbox.script(ACCOUNT, {
            operation: "issue",
            script: { outcome: "fail", failure: { kind: "refused", reason: "tax_code_invalid" } },
        })

        const thrown = await thrownOf(service.issue(CONNECTION, REQUEST))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected })
        expect(providerRefusalDetail(thrown)).toBe("tax_code_invalid")
        expect(proofOf(thrown)).toBe("not_sent")
        expect((await sandbox.calls(ACCOUNT))[0]?.result).toMatchObject({ outcome: "failed", failure: { kind: "refused" } })
    })

    it("fails an unavailable provider as not sent and a timeout as effect unknown", async () => {
        const { sandbox, service } = setup()
        await sandbox.script(ACCOUNT, { operation: "issue", script: { outcome: "fail", failure: { kind: "unavailable" } }, times: 1 })
        await sandbox.script(ACCOUNT, { operation: "issue", key: "d-2", script: { outcome: "fail", failure: { kind: "timeout" } }, times: 1 })

        const unavailable = await thrownOf(service.issue(CONNECTION, REQUEST))
        const timeout = await thrownOf(service.issue(CONNECTION, { draftId: "d-2", renewalId: null }))

        expect(proofOf(unavailable)).toBe("not_sent")
        expect(proofOf(timeout)).toBe("unknown")
        expect(providerRefusalReason(timeout)).toBeNull()
    })

    it("fails an expired credential as the auth refusal and a missing thing as not found", async () => {
        const { sandbox, service } = setup()
        await sandbox.script(ACCOUNT, { operation: "issue", script: { outcome: "fail", failure: { kind: "auth_expired" } }, times: 1 })
        await sandbox.script(ACCOUNT, { operation: "issue", key: "d-2", script: { outcome: "fail", failure: { kind: "not_found" } }, times: 1 })

        const auth = await thrownOf(service.issue(CONNECTION, REQUEST))
        const missing = await thrownOf(service.issue(CONNECTION, { draftId: "d-2", renewalId: null }))

        expect(providerRefusalReason(auth)).toBe("auth_refused")
        expect(proofOf(auth)).toBe("not_sent")
        expect(providerRefusalReason(missing)).toBe("not_found")
        expect(proofOf(missing)).toBe("not_sent")
    })

    it("fails once when scripted once, then issues", async () => {
        const { sandbox, service } = setup()
        await sandbox.script(ACCOUNT, { operation: "issue", script: { outcome: "fail", failure: { kind: "unavailable" } }, times: 1 })

        await expect(service.issue(CONNECTION, REQUEST)).rejects.toMatchObject({ code: ProviderRegistryErrorCode.CallNotSent })
        await expect(service.issue(CONNECTION, REQUEST)).resolves.toMatchObject({ state: "issued" })
        expect(await sandbox.calls(ACCOUNT, "issue")).toHaveLength(2)
    })

    it("answers a scripted answer as the invoice", async () => {
        const { sandbox, service } = setup()
        await sandbox.script(ACCOUNT, {
            operation: "issue",
            script: { outcome: "answer", value: { id: "i-1", state: "draft", invoiceNo: null } },
            times: 1,
        })

        await expect(service.issue(CONNECTION, REQUEST)).resolves.toEqual({ id: "i-1", state: "draft", invoiceNo: null })
    })

    it("reaches no network: one constructor argument and no client or host in the source", () => {
        const source = fs.readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(MisaMeinvoiceSandboxInvoiceService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })

    it("refuses a LIVE account through the frame", async () => {
        const live = sandboxAccount({ id: "conn-live", provider: MISA_MEINVOICE_PROVIDER, sandbox: false })
        const { sandbox } = sandboxServiceOf(live)
        const service = new MisaMeinvoiceSandboxInvoiceService(sandbox)
        const liveConnection = connectionRecord({ id: "conn-live", workspaceId: "ws-1", provider: MISA_MEINVOICE_PROVIDER })

        await expect(service.issue(liveConnection, REQUEST)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
    })
})
