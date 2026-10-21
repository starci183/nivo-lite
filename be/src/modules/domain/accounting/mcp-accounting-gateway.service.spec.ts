import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { CapabilityRole, GatewayCallResult, GatewayJson, RoleResolution } from "@modules/domain/mcp-gateway"
import { CLOCK } from "@modules/platform/clock"
import { McpAccountingGatewayService } from "./mcp-accounting-gateway.service"

const DRAFT = {
    source: "xml",
    template: "1",
    series: "C26TLA",
    invoiceNo: "17",
    issuedOn: "2026-10-19",
    sellerName: "Linh An",
    sellerTaxCode: "0100109106",
    buyerName: "Guesthouse",
    buyerTaxCode: "0108896128",
    lines: [{ name: "Towels", quantity: 20, amountVnd: 2_000_000, vatRate: 10 }, "broken"],
    subtotalVnd: 2_000_000,
    vatVnd: 200_000,
    totalVnd: 2_200_000,
}

/** The tool each role resolves to in the fixture workspace (neutral connector names). */
const TOOLS: Readonly<Record<CapabilityRole, string>> = {
    "identity.find": "crm.parties.find",
    "identity.upsert": "crm.parties.upsert",
    "invoice.list": "inbox.invoices.list",
    "payment.credits.list": "bank.transactions.list",
    "payment.debits.list": "bank.debits.list",
    "receivable.find": "billing.receivables.find",
    "receivable.recordPayment": "billing.receivables.pay",
}

const ROLES: ReadonlyArray<CapabilityRole> = [
    "invoice.list",
    "payment.credits.list",
    "payment.debits.list",
    "receivable.find",
    "receivable.recordPayment",
]

/** No connector of the fixture catalog is offered for any role (the readiness tests read only `ready`). */
const PROVIDERS: Readonly<Record<CapabilityRole, ReadonlyArray<string>>> = {
    "identity.find": [],
    "identity.upsert": [],
    "invoice.list": [],
    "payment.credits.list": [],
    "payment.debits.list": [],
    "receivable.find": [],
    "receivable.recordPayment": [],
}

const ANSWERS: Readonly<Record<string, GatewayJson>> = {
    "inbox.invoices.list": {
        invoices: [
            {
                id: "r-1:0",
                number: "17",
                sellerName: "Linh An",
                sellerTaxCode: "0100109106",
                totalVnd: 2_200_000,
                issuedOn: "2026-10-19",
                draft: DRAFT,
            },
            { id: "", number: "" },
            "junk",
        ],
    },
    "bank.transactions.list": {
        transactions: [
            {
                id: "t-1",
                reference: "PAY F7K2Q9",
                amountVnd: 1_500_000,
                occurredAt: "2026-10-20T01:00:00Z",
                status: "matched",
            },
            { id: "" },
        ],
    },
    "bank.debits.list": {
        transactions: [
            {
                id: "d-1",
                reference: "TT HD 17",
                amountVnd: 4_620_000,
                occurredAt: "2026-10-19T03:00:00Z",
                status: "matched",
            },
            { id: "" },
        ],
    },
    "billing.receivables.find": {
        found: true,
        receivableId: "rc-1",
        balanceVnd: 1_500_000,
        opaque: "kept by the connector",
    },
    "billing.receivables.pay": { paymentId: "p-1" },
}

interface BuildOptions {
    /** The roles the workspace has a tool for. */
    readonly roles?: ReadonlyArray<CapabilityRole>
    /** The agents granted the resolved tool. */
    readonly agents?: ReadonlyArray<string>
    /** Whether the gateway answers the call. */
    readonly ok?: boolean
}

const resolutionOf = (role: CapabilityRole, roles: ReadonlyArray<CapabilityRole>): RoleResolution => {
    if (!roles.includes(role)) return { ok: false, code: "no_capability", role }
    const name = TOOLS[role]
    const connector = name.split(".")[0] ?? ""
    return { ok: true, tool: { role, name, connector, connectorName: connector.toUpperCase() } }
}

const build = async ({ roles = ROLES, agents = ["agent-kt"], ok = true }: BuildOptions = {}) => {
    const gateway = mock<McpGatewayService>({
        toolForRole: jest.fn((_workspaceId: string, role: CapabilityRole) =>
            Promise.resolve(resolutionOf(role, roles)),
        ),
        agentsGranted: jest.fn(() => Promise.resolve(agents)),
        readiness: jest.fn((_workspaceId: string, wanted: ReadonlyArray<CapabilityRole>) =>
            Promise.resolve({ ready: wanted.every((role) => roles.includes(role)), missing: [], providers: PROVIDERS }),
        ),
        call: jest.fn((_caller: unknown, name: string): Promise<GatewayCallResult> =>
            Promise.resolve(
                ok ? { ok: true, value: ANSWERS[name] ?? {} } : { ok: false, code: "unavailable", detail: name },
            ),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpAccountingGatewayService,
            { provide: McpGatewayService, useValue: gateway },
            { provide: CLOCK, useValue: new FakeClock("2026-10-20T07:00:00.000Z") },
        ],
    }).compile()
    return { service: moduleRef.get(McpAccountingGatewayService), gateway }
}

const CALLER = { workspaceId: "ws-1", agentId: "agent-kt", conversationId: null, workItemId: null }

describe("McpAccountingGatewayService", () => {
    it("reads invoices and payables by the invoice.list role and cites the tool that answered", async () => {
        const { service, gateway } = await build()

        const invoices = await service.listEinvoices("ws-1", "2026-10-19T07:00:00.000Z")
        expect(invoices.tool).toBe("inbox.invoices.list")
        expect(invoices.value).toHaveLength(1)
        expect(invoices.value[0]?.draft.lines).toEqual([
            { name: "Towels", quantity: 20, amountVnd: 2_000_000, vatRate: 10 },
        ])
        await expect(service.listOpenPayables("ws-1")).resolves.toEqual([
            {
                supplier: "Linh An",
                sellerTaxCode: "0100109106",
                invoiceNo: "17",
                amountVnd: 2_200_000,
                issuedOn: "2026-10-19",
            },
        ])

        expect(gateway.toolForRole).toHaveBeenCalledWith("ws-1", "invoice.list")
        expect(gateway.agentsGranted).toHaveBeenCalledWith("ws-1", ["inbox.invoices.list", "inbox.*"])
        expect(gateway.call).toHaveBeenCalledWith(CALLER, "inbox.invoices.list", { since: "2026-10-19", limit: 50 })
        expect(gateway.call).toHaveBeenCalledWith(CALLER, "inbox.invoices.list", { since: "2026-08-21", limit: 50 })
    })

    it("reads payment credits and finds the receivable a memo names, passing the memo as it is", async () => {
        const { service, gateway } = await build()

        await expect(service.listPaymentCredits("ws-1", "2026-10-19T07:00:00.000Z")).resolves.toEqual({
            tool: "bank.transactions.list",
            value: [
                {
                    creditRef: "t-1",
                    reference: "PAY F7K2Q9",
                    amountVnd: 1_500_000,
                    occurredAt: "2026-10-20T01:00:00Z",
                    matched: true,
                },
            ],
        })
        await expect(service.findReceivable("ws-1", "PAY F7K2Q9 thanks")).resolves.toEqual({
            tool: "billing.receivables.find",
            value: { receivableId: "rc-1", balanceVnd: 1_500_000 },
        })

        expect(gateway.call).toHaveBeenCalledWith(CALLER, "billing.receivables.find", {
            reference: "PAY F7K2Q9 thanks",
        })
        await expect(service.listPaymentDebits("ws-1", "2026-08-21T07:00:00.000Z")).resolves.toEqual({
            tool: "bank.debits.list",
            value: [
                {
                    creditRef: "d-1",
                    reference: "TT HD 17",
                    amountVnd: 4_620_000,
                    occurredAt: "2026-10-19T03:00:00Z",
                    matched: true,
                },
            ],
        })
    })

    it("records a payment keyed by the credit, so a replayed tick never records it twice", async () => {
        const { service, gateway } = await build()

        await expect(
            service.recordPayment("ws-1", { receivableId: "rc-1", creditRef: "t-1", amountVnd: 1_500_000 }),
        ).resolves.toBe(true)

        expect(gateway.call).toHaveBeenCalledWith(
            { ...CALLER, opKey: "accounting-morning:ws-1:t-1" },
            "billing.receivables.pay",
            { receivableId: "rc-1", amountVnd: 1_500_000, paymentRef: "t-1" },
        )
    })
})

describe("McpAccountingGatewayService readiness and refusals", () => {
    it("names the connector that feeds payment credits and says which optional features are connected", async () => {
        const { service, gateway } = await build({ roles: ["payment.credits.list", "invoice.list", "receivable.find"] })

        await expect(service.creditsSource("ws-1")).resolves.toBe("BANK")
        await expect(service.connections("ws-1")).resolves.toEqual({ invoices: true, receivables: false })
        expect(gateway.readiness).toHaveBeenCalledWith("ws-1", ["receivable.find", "receivable.recordPayment"])
    })

    it("reads nothing and cites no tool when the workspace has no tool for a role", async () => {
        const { service, gateway } = await build({ roles: [] })

        await expect(service.creditsSource("ws-1")).resolves.toBeNull()

        await expect(service.listEinvoices("ws-1", "2026-10-19T07:00:00.000Z")).resolves.toEqual({
            tool: null,
            value: [],
        })
        await expect(service.findReceivable("ws-1", "X")).resolves.toEqual({ tool: null, value: null })
        expect(gateway.agentsGranted).not.toHaveBeenCalled()
    })

    it("reads nothing when no agent holds the resolved tool or the gateway refuses the call", async () => {
        const unheld = await build({ agents: [] })
        await expect(unheld.service.listPaymentCredits("ws-1", "2026-10-19T07:00:00.000Z")).resolves.toEqual({
            tool: null,
            value: [],
        })
        await expect(
            unheld.service.recordPayment("ws-1", { receivableId: "rc", creditRef: "t", amountVnd: 1 }),
        ).resolves.toBe(false)
        expect(unheld.gateway.call).not.toHaveBeenCalled()

        const refused = await build({ ok: false })
        await expect(refused.service.listOpenPayables("ws-1")).resolves.toEqual([])
        await expect(refused.service.findReceivable("ws-1", "X")).resolves.toEqual({ tool: null, value: null })
    })
})
