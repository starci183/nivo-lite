import { Injectable, Optional } from "@nestjs/common"
import { PaymentTransactionsService } from "@modules/domain/payment-transactions"
import { McpGatewayError, McpGatewayErrorCode } from "../errors/mcp-gateway.error"
import type { GatewayJson, NativeAdapter, NativeConnectorManifest } from "../mcp-gateway.contracts"
import { SEPAY_BANK_MOVE_INPUT_SCHEMA, SEPAY_BANK_MOVE_SCHEMA } from "./sepay-native.schema"

/** The members of a bank move the audit masks: who paid and the memo they wrote, which often carry a name or an order. */
const BANK_MOVE_SECRET_FIELDS: ReadonlyArray<string> = ["payer", "reference"]

/** The SePay native connector: the bank credits and debits SePay delivered to the workspace, read from NIVO's own ledger. */
export const SEPAY_MANIFEST: NativeConnectorManifest = {
    key: "sepay",
    name: "SePay",
    kind: "native",
    contractVersion: "sepay-native@1",
    tools: [
        {
            name: "transaction.list",
            description:
                "Latest bank credits (money in) of the workspace: amount, reference, payer, status; filter by status and since.",
            scope: "read",
            defaultMode: "auto",
            role: "payment.credits.list",
            inputSchema: SEPAY_BANK_MOVE_INPUT_SCHEMA,
            argumentSchema: SEPAY_BANK_MOVE_SCHEMA,
            secretFields: BANK_MOVE_SECRET_FIELDS,
            internalOnly: true,
        },
        {
            name: "debit.list",
            description:
                "Latest bank debits (money out, for example supplier payments) of the workspace, with the same fields and filters.",
            scope: "read",
            defaultMode: "auto",
            role: "payment.debits.list",
            inputSchema: SEPAY_BANK_MOVE_INPUT_SCHEMA,
            argumentSchema: SEPAY_BANK_MOVE_SCHEMA,
            secretFields: BANK_MOVE_SECRET_FIELDS,
            internalOnly: true,
        },
    ],
}

@Injectable()
/**
 * Runs the SePay tools for a workspace, through the gateway like any other connector. The credits and debits are the workspace's
 * `payment.transaction` records, read through their owner (`PaymentTransactionsService.list`), never by SQL of the gateway's own. An app
 * without the entity engine (the cli) has no records to read and answers the tool as unknown.
 */
export class SepayNativeService implements NativeAdapter {
    readonly manifest: NativeConnectorManifest = SEPAY_MANIFEST

    constructor(@Optional() private readonly transactions?: PaymentTransactionsService) {}

    /** Runs one SePay tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson): Promise<GatewayJson> {
        if (this.transactions === undefined || (tool !== "transaction.list" && tool !== "debit.list")) {
            throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })
        }
        const parsed = SEPAY_BANK_MOVE_SCHEMA.safeParse(args)
        if (!parsed.success) {
            throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool } })
        }
        const rows = await this.transactions.list(workspaceId, {
            direction: tool === "transaction.list" ? "credit" : "debit",
            status: parsed.data.status ?? null,
            since: parsed.data.since === undefined ? null : new Date(parsed.data.since).toISOString(),
            limit: parsed.data.limit,
        })
        return {
            transactions: rows.map((row) => ({
                id: row.id,
                amountVnd: row.amountVnd,
                reference: row.reference,
                payer: row.payer,
                status: row.status,
                occurredAt: row.occurredAt,
            })),
        }
    }
}
