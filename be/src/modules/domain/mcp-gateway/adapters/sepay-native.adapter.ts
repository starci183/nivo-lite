import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { GatewayConnectorManifest, JsonObject, NativeAdapter } from "../mcp-gateway.contracts"
import { McpGatewayError, McpGatewayErrorCode } from "../errors/mcp-gateway.error"
import { LIST_BANK_TRANSACTIONS } from "../persistence/sepay-native.sql"
import type { BankTransactionRow } from "../persistence/sepay-native.rows"

const LIMIT_MAX = 50
const LIMIT_DEFAULT = 20
const STATUSES: ReadonlySet<string> = new Set(["unmatched", "matched", "needs_review"])

/** The SePay native connector: the bank credits SePay delivered to the workspace, read from NIVO's own ledger. */
export const SEPAY_MANIFEST: GatewayConnectorManifest = {
    key: "sepay",
    name: "SePay",
    kind: "native",
    contractVersion: "sepay-native@1",
    tools: [
        {
            name: "transactions.list",
            description:
                "Latest bank credits of the workspace (amount, reference, payer, status); filter by status and since.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: {
                type: "object",
                properties: {
                    status: { type: "string", enum: ["unmatched", "matched", "needs_review"] },
                    since: { type: "string", format: "date-time" },
                    limit: { type: "integer", minimum: 1, maximum: LIMIT_MAX },
                },
            },
        },
    ],
}

const limitOf = (value: unknown): number =>
    typeof value === "number" && Number.isInteger(value) ? Math.min(LIMIT_MAX, Math.max(1, value)) : LIMIT_DEFAULT

const statusOf = (value: unknown): string | null => (typeof value === "string" && STATUSES.has(value) ? value : null)

const sinceOf = (value: unknown): string | null =>
    typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null

const isoOf = (value: Date | string): string => (value instanceof Date ? value.toISOString() : value)

@Injectable()
/** Runs the SePay tools for a workspace, through the gateway like any other connector. */
export class SepayNativeAdapter implements NativeAdapter {
    readonly manifest = SEPAY_MANIFEST

    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Runs one SePay tool. */
    async invoke(workspaceId: string, tool: string, args: JsonObject): Promise<JsonObject> {
        if (tool !== "transactions.list") {
            throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })
        }
        const rows: ReadonlyArray<BankTransactionRow> = await this.entityManager.query(LIST_BANK_TRANSACTIONS, [
            workspaceId,
            statusOf(args.status),
            sinceOf(args.since),
            limitOf(args.limit),
        ])
        return {
            transactions: rows.map((row) => ({
                id: row.id,
                amountVnd: Number(row.amount_vnd),
                reference: row.reference,
                payer: row.payer,
                status: row.status,
                occurredAt: isoOf(row.occurred_at),
            })),
        }
    }
}
