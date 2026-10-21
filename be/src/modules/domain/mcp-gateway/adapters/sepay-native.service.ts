import { Injectable } from "@nestjs/common"
import { TransactionsService } from "@modules/domain/transactions"
import { McpGatewayError, McpGatewayErrorCode } from "../errors/mcp-gateway.error"
import type { GatewayConnectorManifest, GatewayJson, NativeAdapter } from "../mcp-gateway.contracts"

const LIMIT_MAX = 50
const LIMIT_DEFAULT = 20
const STATUSES: ReadonlySet<string> = new Set(["unmatched", "matched", "needs_review"])

/** The filters both SePay tools take. */
const BANK_MOVE_SCHEMA = {
    type: "object",
    properties: {
        status: { type: "string", enum: ["unmatched", "matched", "needs_review"] },
        since: { type: "string", format: "date-time" },
        limit: { type: "integer", minimum: 1, maximum: LIMIT_MAX },
    },
}

/** The SePay native connector: the bank credits and debits SePay delivered to the workspace, read from NIVO's own ledger. */
export const SEPAY_MANIFEST: GatewayConnectorManifest = {
    key: "sepay",
    name: "SePay",
    kind: "native",
    contractVersion: "sepay-native@1",
    tools: [
        {
            name: "transactions.list",
            description:
                "Latest bank credits (money in) of the workspace: amount, reference, payer, status; filter by status and since.",
            scope: "read",
            defaultMode: "auto",
            role: "payment.credits.list",
            inputSchema: BANK_MOVE_SCHEMA,
        },
        {
            name: "transactions.debits",
            description:
                "Latest bank debits (money out, for example supplier payments) of the workspace, with the same fields and filters.",
            scope: "read",
            defaultMode: "auto",
            role: "payment.debits.list",
            inputSchema: BANK_MOVE_SCHEMA,
        },
    ],
}

const limitOf = (value: unknown): number =>
    typeof value === "number" && Number.isInteger(value) ? Math.min(LIMIT_MAX, Math.max(1, value)) : LIMIT_DEFAULT

const statusOf = (value: unknown): string | null => (typeof value === "string" && STATUSES.has(value) ? value : null)

const sinceOf = (value: unknown): string | null =>
    typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null

@Injectable()
/**
 * Runs the SePay tools for a workspace, through the gateway like any other connector. The credits and debits are read through the
 * owner of public.transactions (`TransactionsService.listBankCredits` / `listBankDebits`), never by SQL of the gateway's own.
 */
export class SepayNativeService implements NativeAdapter {
    readonly manifest = SEPAY_MANIFEST

    constructor(private readonly transactions: TransactionsService) {}

    /** Runs one SePay tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson): Promise<GatewayJson> {
        if (tool !== "transactions.list" && tool !== "transactions.debits") {
            throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })
        }
        const query = {
            workspaceId,
            status: statusOf(args.status),
            since: sinceOf(args.since),
            limit: limitOf(args.limit),
        }
        const credits = await (tool === "transactions.list"
            ? this.transactions.listBankCredits(query)
            : this.transactions.listBankDebits(query))
        return {
            transactions: credits.map((credit) => ({
                id: credit.id,
                amountVnd: credit.amount_vnd,
                reference: credit.reference,
                payer: credit.payer,
                status: credit.status,
                occurredAt: credit.occurred_at,
            })),
        }
    }
}
