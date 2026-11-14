import { Injectable, Optional } from "@nestjs/common"
import { AccountDataReadService, type StoredRow } from "@modules/domain/account-data"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { ToolsError, ToolsErrorCode } from "../errors/tools.error"
import type { ToolJson, NativeToolFamily, ToolManifest } from "../tools.contracts"
import {
    SEPAY_BANK_MOVE_INPUT_SCHEMA,
    SEPAY_BANK_MOVE_SCHEMA,
    SEPAY_CREDIT_LIST_INPUT_SCHEMA,
    SEPAY_CREDIT_LIST_SCHEMA,
} from "./sepay-native.schema"

/** The members of a bank move the audit masks: who paid and the memo they wrote, which often carry a name or an order. */
const BANK_MOVE_SECRET_FIELDS: ReadonlyArray<string> = ["payer", "reference"]

/** The provider whose accounts the lists read. */
const SEPAY = "sepay"

/** The raw type a SePay account keeps each bank movement under, exactly as SePay reported it (the bank feed's intake writes it). */
const SEPAY_TRANSACTION = "sepay.transaction"

/** The most SePay accounts of one workspace a list looks across. */
const ACCOUNTS_MAX = 20

/** The most raw rows of one account a list reads before it keeps the moves of its direction. */
const ROWS_READ = 200

/** The direction of a move as the raw row holds it. */
type Direction = "credit" | "debit"

/** One bank move as both lists answer it, read from the raw row as the provider sent it. */
interface Listed {
    readonly id: string
    readonly amountVnd: number
    readonly reference: string
    readonly payer: string | null
    readonly occurredAt: string
}

/** The move a raw row holds, or null when the row is not a move of the direction. */
const listedOf = (row: Pick<StoredRow, "id" | "value" | "occurredAt">, direction: Direction): Listed | null => {
    const { amount, content, payer } = row.value
    if (row.value.direction !== direction || typeof amount !== "number" || typeof content !== "string") return null
    return {
        id: row.id,
        amountVnd: amount,
        reference: content,
        payer: typeof payer === "string" ? payer : null,
        occurredAt: new Date(row.occurredAt).toISOString(),
    }
}

/** Orders two moves newest first, by the instant each occurred at. */
const newestFirst = (left: Listed, right: Listed): number => {
    if (left.occurredAt < right.occurredAt) return 1
    return left.occurredAt > right.occurredAt ? -1 : 0
}

/** The tool of the received credits (`nivo.tool.payment.credit.list`), inside the connector. */
export const CREDIT_LIST = "credit.list"

/** The tool of the money that went out (`nivo.tool.payment.debit.list`), inside the connector. */
export const DEBIT_LIST = "debit.list"

/**
 * The connector of the bank moves the workspace's SePay accounts reported: the credits and debits read from the accounts' own raw
 * `sepay.transaction` rows, as SePay sent them. Its row key is `sepay`, and its tools are published under the platform's purpose prefix
 * `nivo.tool.payment`, so their full names are `nivo.tool.payment.credit.list` and `nivo.tool.payment.debit.list` (`TOOL.paymentCreditList`,
 * `TOOL.paymentDebitList`). The key differs from the effect connector `payment`, so the two are never merged.
 */
export const SEPAY_MANIFEST: ToolManifest = {
    key: "sepay",
    namespace: "nivo.tool.payment",
    name: "SePay",
    contractVersion: "sepay-native@1",
    tools: [
        {
            name: CREDIT_LIST,
            description:
                "Latest bank credits (money in) the workspace's SePay accounts reported: amount, transfer content, payer, when; filter by since, or name the one credit you handle (transactionId).",
            scope: "read",
            defaultMode: "auto",
            role: "payment.credits.list",
            inputSchema: SEPAY_CREDIT_LIST_INPUT_SCHEMA,
            argumentSchema: SEPAY_CREDIT_LIST_SCHEMA,
            secretFields: BANK_MOVE_SECRET_FIELDS,
            internalOnly: true,
        },
        {
            name: DEBIT_LIST,
            description:
                "Latest bank debits (money out, for example supplier payments) the workspace's SePay accounts reported, with the same fields and filter.",
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
 * Runs the credit and debit lists for a workspace, through the gateway like any other connector: a plain read of the raw rows its SePay
 * accounts hold (`AccountDataReadService`), never the provider and never a business record. Naming a credit (`transactionId`, the row
 * id the bank trigger names) answers that one row when it is a credit of one of the workspace's own accounts. An app without the
 * account store answers the tools as unknown.
 */
export class SepayNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = SEPAY_MANIFEST

    constructor(
        @Optional() private readonly rows?: AccountDataReadService,
        @Optional() private readonly connections?: ConnectionBindingsReadService,
    ) {}

    /** Runs one tool of the bank moves; any other tool is unknown. */
    async invoke(workspaceId: string, tool: string, args: ToolJson): Promise<ToolJson> {
        if (this.rows === undefined || this.connections === undefined || (tool !== CREDIT_LIST && tool !== DEBIT_LIST)) {
            throw new ToolsError({ code: ToolsErrorCode.UnknownTool, params: { tool } })
        }
        if (tool === DEBIT_LIST) return this.listed(workspaceId, "debit", SEPAY_BANK_MOVE_SCHEMA.safeParse(args).data, tool)
        const parsed = SEPAY_CREDIT_LIST_SCHEMA.safeParse(args).data
        if (parsed?.transactionId !== undefined) return { transactions: await this.namedCredit(workspaceId, parsed.transactionId) }
        return this.listed(workspaceId, "credit", parsed, tool)
    }

    /** The newest moves of a direction since the instant, within the limit; arguments that did not parse are invalid. */
    private async listed(
        workspaceId: string,
        direction: Direction,
        filters: { readonly since?: string | undefined; readonly limit: number } | undefined,
        tool: string,
    ): Promise<ToolJson> {
        if (filters === undefined) throw new ToolsError({ code: ToolsErrorCode.InvalidArguments, params: { tool } })
        const since = filters.since === undefined ? null : new Date(filters.since).toISOString()
        const moves = await this.moves(workspaceId, direction)
        return {
            transactions: moves
                .filter((move) => since === null || move.occurredAt >= since)
                .toSorted(newestFirst)
                .slice(0, filters.limit)
                .map((move) => ({ ...move })),
        }
    }

    /** The one credit a step names: the raw row of that id, when it is a credit of one of the workspace's own accounts. */
    private async namedCredit(workspaceId: string, id: string): Promise<ReadonlyArray<ToolJson>> {
        const row = await this.rows?.byId(SEPAY_TRANSACTION, id)
        if (row === null || row === undefined) return []
        const own = await this.connections?.recordOf(workspaceId, row.connectionId)
        const move = own === null || own === undefined ? null : listedOf(row, "credit")
        return move === null ? [] : [{ ...move }]
    }

    /** The moves of a direction across the workspace's SePay accounts, each account's newest rows. */
    private async moves(workspaceId: string, direction: Direction): Promise<ReadonlyArray<Listed>> {
        const { rows, connections } = this
        if (rows === undefined || connections === undefined) return []
        const accounts = await connections.ofProvider(workspaceId, SEPAY, ACCOUNTS_MAX)
        const read = await Promise.all(accounts.map((account) => rows.newest(account.id, SEPAY_TRANSACTION, ROWS_READ)))
        return read.flat().flatMap((row) => {
            const move = listedOf(row, direction)
            return move === null ? [] : [move]
        })
    }
}
