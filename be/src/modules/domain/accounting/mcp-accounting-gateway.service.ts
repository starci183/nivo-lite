import { Injectable } from "@nestjs/common"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { CapabilityRole, GatewayCaller, GatewayJson } from "@modules/domain/mcp-gateway"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { DeskConnections, GatewayPayable, OptionalConnectorName } from "./accounting-desk.contracts"
import type {
    AccountingGateway,
    GatewayEinvoice,
    OptionalReceivable,
    PaymentCredit,
    ReceivablePayment,
    RoleAnswer,
} from "./accounting-gateway.port"
import { einvoiceOf, payableOf, paymentCreditOf, receivableOf, recordedOf } from "./mcp-accounting-gateway.mapper"

/** How far back the open payables are read (the supplier terms are shorter). */
const PAYABLE_WINDOW_DAYS = 60
const DAY_MS = 86_400_000
const LIST_LIMIT = 50

const listOf = (value: GatewayJson, key: string): ReadonlyArray<unknown> => {
    const list = value[key]
    return Array.isArray(list) ? list : []
}

@Injectable()
/**
 * The accounting desk's sources as capability roles of the NIVO MCP gateway: each call resolves its role to the workspace's tool
 * (`toolForRole`) and runs it as the agent granted that tool, so the gateway applies the grant, the approval, the breaker and the
 * audit. No connector or tool is named here. A role the workspace has no tool for, or a refused or failed call, reads as "nothing
 * there" with no tool to cite (the desk never claims what a connector did not answer).
 */
export class McpAccountingGatewayService implements AccountingGateway {
    constructor(
        private readonly gateway: McpGatewayService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** `invoice.list`: the invoices received since the instant. */
    async listEinvoices(workspaceId: string, since: string): Promise<RoleAnswer<ReadonlyArray<GatewayEinvoice>>> {
        const answer = await this.ask(workspaceId, "invoice.list", { since: since.slice(0, 10), limit: LIST_LIMIT })
        return { tool: answer.tool, value: listOf(answer.value, "invoices").flatMap((row) => einvoiceOf(row) ?? []) }
    }

    /** The supplier invoices of the payable window (no supplier-payment feed exists yet, so every one counts as open). */
    async listOpenPayables(workspaceId: string): Promise<ReadonlyArray<GatewayPayable>> {
        const since = new Date(this.clock.now().getTime() - PAYABLE_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10)
        const answer = await this.ask(workspaceId, "invoice.list", { since, limit: LIST_LIMIT })
        return listOf(answer.value, "invoices").flatMap((row) => payableOf(row) ?? [])
    }

    /** `payment.credits.list`: the payment credits since the instant. */
    async listPaymentCredits(workspaceId: string, since: string): Promise<RoleAnswer<ReadonlyArray<PaymentCredit>>> {
        const answer = await this.ask(workspaceId, "payment.credits.list", { since, limit: LIST_LIMIT })
        return {
            tool: answer.tool,
            value: listOf(answer.value, "transactions").flatMap((row) => paymentCreditOf(row) ?? []),
        }
    }

    /** `payment.debits.list`: the outgoing payments since the instant. */
    async listPaymentDebits(workspaceId: string, since: string): Promise<RoleAnswer<ReadonlyArray<PaymentCredit>>> {
        const answer = await this.ask(workspaceId, "payment.debits.list", { since, limit: LIST_LIMIT })
        return {
            tool: answer.tool,
            value: listOf(answer.value, "transactions").flatMap((row) => paymentCreditOf(row) ?? []),
        }
    }

    /** `receivable.find` with the memo as it is: the connector reads its own reference format. */
    async findReceivable(workspaceId: string, reference: string): Promise<RoleAnswer<OptionalReceivable>> {
        const answer = await this.ask(workspaceId, "receivable.find", { reference })
        return { tool: answer.tool, value: receivableOf(answer.value) }
    }

    /**
     * `receivable.recordPayment`, keyed by the credit: the gateway step key (and the replay key it derives) is the credit itself, so a
     * replayed morning tick, on any date, never records the same credit twice.
     */
    async recordPayment(workspaceId: string, payment: ReceivablePayment): Promise<boolean> {
        const args = { receivableId: payment.receivableId, amountVnd: payment.amountVnd, paymentRef: payment.creditRef }
        const opKey = `accounting-morning:${workspaceId}:${payment.creditRef}`
        const answer = await this.ask(workspaceId, "receivable.recordPayment", args, opKey)
        return recordedOf(answer.value)
    }

    /** The display name of the connector the workspace's `payment.credits.list` resolves to; null when none does. */
    async creditsSource(workspaceId: string): Promise<OptionalConnectorName> {
        const resolution = await this.gateway.toolForRole(workspaceId, "payment.credits.list")
        return resolution.ok ? resolution.tool.connectorName : null
    }

    /** Whether the workspace can play `invoice.list` and both `receivable.*` roles now (a usable tool for each). */
    async connections(workspaceId: string): Promise<DeskConnections> {
        const [invoices, receivables] = await Promise.all([
            this.gateway.readiness(workspaceId, ["invoice.list"]),
            this.gateway.readiness(workspaceId, ["receivable.find", "receivable.recordPayment"]),
        ])
        return { invoices: invoices.ready, receivables: receivables.ready }
    }

    private async ask(
        workspaceId: string,
        role: CapabilityRole,
        args: GatewayJson,
        opKey?: string,
    ): Promise<RoleAnswer<GatewayJson>> {
        const resolution = await this.gateway.toolForRole(workspaceId, role)
        if (!resolution.ok) return { tool: null, value: {} }
        const { tool } = resolution
        const [agentId] = await this.gateway.agentsGranted(workspaceId, [tool.name, `${tool.connector}.*`])
        if (agentId === undefined) return { tool: null, value: {} }
        const caller: GatewayCaller = { workspaceId, agentId, conversationId: null, workItemId: null, opKey }
        const result = await this.gateway.call(caller, tool.name, args)
        return result.ok ? { tool: tool.name, value: result.value } : { tool: null, value: {} }
    }
}
