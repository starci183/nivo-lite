import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import type { NativeCaller } from "@modules/domain/tools"
import { InvoiceIssueRegistryService, proofOf, type InvoiceIssuePort } from "@modules/domain/provider-registry"
import { MisaMeinvoiceSandboxInvoiceService } from "@modules/domain/misa-meinvoice-provider/misa-meinvoice-sandbox-invoice.service"
import {
    MISA_SANDBOX_CASE,
    MISA_SANDBOX_ISSUE_OPERATION,
} from "@modules/domain/misa-meinvoice-provider/misa-meinvoice-sandbox.catalogue"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { INVOICE_TOOL_BUSINESS_REFUSALS, INVOICE_TOOL_REFUSALS } from "./invoice-refusal.policy"
import { INVOICE_REFUSAL_CLASS } from "./invoice-refusal.policy"
import { INVOICE_MANIFEST, INVOICE_TOOL, InvoiceToolsService } from "./invoice-tools.service"

/**
 * `nivo.tool.invoice.create` on a MISA meInvoice SANDBOX account (owner rulings R56/R57): the tool runs through the provider registry's
 * one switch to the real sandbox implementation over a memory sandbox store, so the outcomes are the shapes the matrix will see. Each case
 * is picked as the account's next case of `issue` (R62), as the Sandbox page picks it.
 */
const ACCOUNT = sandboxAccount({ id: "conn-m", workspaceId: "ws-1", provider: "misa_meinvoice" })
const SELLER: ConnectionRecord = connectionRecord({ id: "conn-m", workspaceId: "ws-1", provider: "misa_meinvoice", sandbox: true })
const caller = (connectionId?: string): NativeCaller => ({
    agentId: "agent-books",
    conversationId: null,
    ...(connectionId === undefined ? {} : { connectionId, provider: "misa_meinvoice" }),
})

const build = (found: ConnectionRecord | null = SELLER) => {
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(found)
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    const registry = new InvoiceIssueRegistryService()
    // A live port that must never be reached by a sandbox account (the one switch picks by the account's flag).
    const live = mock<InvoiceIssuePort>({ provider: "misa_meinvoice" })
    registry.register({ live, sandbox: new MisaMeinvoiceSandboxInvoiceService(sandbox) })
    const pick = (caseId: string): Promise<void> => sandbox.setNextCase(ACCOUNT, MISA_SANDBOX_ISSUE_OPERATION, caseId)
    return { service: new InvoiceToolsService(connections, registry), sandbox, live, pick }
}

/** What a rejected call threw, as the gateway reads it. */
const thrownOf = (work: Promise<unknown>): Promise<unknown> => work.then(() => null, (cause: unknown) => cause)

describe("the e-invoice issue family", () => {
    it("serves the one purpose, a write asked by default, internal only", () => {
        expect(INVOICE_MANIFEST.tools.map((tool) => [tool.domain, tool.scope, tool.defaultMode, tool.internalOnly])).toEqual([
            [TOOL.invoiceCreate, "write", "ask", true],
        ])
    })

    it("classes every refusal, closed; the spec's business list is exactly the business class", () => {
        expect([...INVOICE_TOOL_REFUSALS]).toEqual(Object.keys(INVOICE_REFUSAL_CLASS))
        expect([...INVOICE_TOOL_BUSINESS_REFUSALS]).toEqual(
            Object.entries(INVOICE_REFUSAL_CLASS).filter(([, kind]) => kind === "business").map(([reason]) => reason),
        )
    })
})

describe("InvoiceToolsService on a sandbox seller account", () => {
    it("ISSUED (MISA-1, the default): outcome issued with the provider's id, number, date and state; the live port is never reached", async () => {
        const { service, sandbox, live } = build()

        await expect(service.invoke("ws-1", INVOICE_TOOL.create, { draftId: "d-1", renewalId: "r-1" }, caller("conn-m"))).resolves.toEqual({
            outcome: "issued",
            provider: "misa_meinvoice",
            invoiceId: expect.any(String),
            invoiceNo: "C26TSB/00000001",
            issuedOn: "2026-11-14",
            state: expect.any(String),
        })
        expect(jest.mocked(live.issue)).not.toHaveBeenCalled()
        expect(await sandbox.calls(ACCOUNT, MISA_SANDBOX_ISSUE_OPERATION)).toHaveLength(1)
    })

    it("REJECTED (MISA-2): the provider's refusal is the business refusal `rejected` a node branches on; no number consumed", async () => {
        const { service, pick } = build()
        await pick(MISA_SANDBOX_CASE.rejected)

        const thrown = await thrownOf(service.invoke("ws-1", INVOICE_TOOL.create, { draftId: "d-1" }, caller("conn-m")))

        expect(thrown).toMatchObject({ code: "TOOLS_NATIVE_REFUSED", params: { reason: "rejected", refusalClass: "business" } })
        await pick(MISA_SANDBOX_CASE.issued)
        await expect(service.invoke("ws-1", INVOICE_TOOL.create, { draftId: "d-2" }, caller("conn-m"))).resolves.toMatchObject({
            invoiceNo: "C26TSB/00000001",
        })
    })

    it("UNAVAILABLE (MISA-4): a server failure stays a failure proving `not_sent` (nothing issued; the runner moves on, then the step stops)", async () => {
        const { service, pick } = build()
        await pick(MISA_SANDBOX_CASE.unavailable)

        const thrown = await thrownOf(service.invoke("ws-1", INVOICE_TOOL.create, { draftId: "d-1" }, caller("conn-m")))

        expect(proofOf(thrown)).toBe("not_sent")
        expect(thrown).not.toMatchObject({ code: "TOOLS_NATIVE_REFUSED" })
    })

    it.each([MISA_SANDBOX_CASE.noAnswer, MISA_SANDBOX_CASE.timeoutApplied])(
        "UNKNOWN (%s): a lost answer stays a failure proving `unknown` (the step stops for a person, never sent again by itself)",
        async (caseId) => {
            const { service, pick } = build()
            await pick(caseId)

            const thrown = await thrownOf(service.invoke("ws-1", INVOICE_TOOL.create, { draftId: "d-1" }, caller("conn-m")))

            expect(proofOf(thrown)).toBe("unknown")
            expect(thrown).not.toMatchObject({ code: "TOOLS_NATIVE_REFUSED" })
        },
    )

    it("a refused credential (MISA-5) is `connection_refused` and no account handed or found is `not_connected`: the setup, the step freezes", async () => {
        const refusedBuild = build()
        await refusedBuild.pick(MISA_SANDBOX_CASE.authRefused)
        const refused = await thrownOf(refusedBuild.service.invoke("ws-1", INVOICE_TOOL.create, { draftId: "d-1" }, caller("conn-m")))
        expect(refused).toMatchObject({ params: { reason: "connection_refused", refusalClass: "infrastructure" } })

        const unhanded = await thrownOf(build().service.invoke("ws-1", INVOICE_TOOL.create, { draftId: "d-1" }, caller()))
        expect(unhanded).toMatchObject({ params: { reason: "not_connected", refusalClass: "infrastructure" } })
        const missing = await thrownOf(build(null).service.invoke("ws-1", INVOICE_TOOL.create, { draftId: "d-1" }, caller("conn-x")))
        expect(missing).toMatchObject({ params: { reason: "not_connected" } })
    })

    it("refuses arguments the schema does not take and a tool it does not hold", async () => {
        const { service } = build()

        await expect(service.invoke("ws-1", INVOICE_TOOL.create, { draftId: "" }, caller("conn-m"))).rejects.toBeDefined()
        await expect(service.invoke("ws-1", INVOICE_TOOL.create, { draftId: "d-1", total: 5 }, caller("conn-m"))).rejects.toBeDefined()
        await expect(service.invoke("ws-1", "invoice.cancel", { draftId: "d-1" }, caller("conn-m"))).rejects.toBeDefined()
    })
})
