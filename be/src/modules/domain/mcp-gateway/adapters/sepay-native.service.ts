import { Injectable } from "@nestjs/common"
import { TransactionsService } from "@modules/domain/transactions"
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
            name: "transactions.list",
            description:
                "Latest bank credits (money in) of the workspace: amount, reference, payer, status; filter by status and since.",
            scope: "read",
            defaultMode: "auto",
            role: "payment.credits.list",
            inputSchema: SEPAY_BANK_MOVE_INPUT_SCHEMA,
            argumentSchema: SEPAY_BANK_MOVE_SCHEMA,
            secretFields: BANK_MOVE_SECRET_FIELDS,
        },
        {
            name: "transactions.debits",
            description:
                "Latest bank debits (money out, for example supplier payments) of the workspace, with the same fields and filters.",
            scope: "read",
            defaultMode: "auto",
            role: "payment.debits.list",
            inputSchema: SEPAY_BANK_MOVE_INPUT_SCHEMA,
            argumentSchema: SEPAY_BANK_MOVE_SCHEMA,
            secretFields: BANK_MOVE_SECRET_FIELDS,
        },
    ],
}

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
        const parsed = SEPAY_BANK_MOVE_SCHEMA.safeParse(args)
        if (!parsed.success) {
            throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool } })
        }
        const query = {
            workspaceId,
            status: parsed.data.status ?? null,
            since: parsed.data.since === undefined ? null : new Date(parsed.data.since).toISOString(),
            limit: parsed.data.limit,
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
