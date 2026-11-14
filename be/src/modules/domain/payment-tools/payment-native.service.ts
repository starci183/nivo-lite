import { TOOL } from "@nivo-lite/agent-sdk/names"
import { Injectable, Optional } from "@nestjs/common"
import { AccountDataReadService, AccountDataTypesService } from "@modules/domain/account-data"
import { ConnectionsService } from "@modules/domain/connections"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import { PaymentInstructionRegistryService, type TransferInstruction } from "@modules/domain/provider-registry"
import { BANK_TRANSACTION_PURPOSE, creditOf } from "./payment-credit.policy"
import { CREDIT_GET_INPUT_SCHEMA, CREDIT_GET_SCHEMA } from "./payment-credit.schema"
import { TRANSFER_CREATE_INPUT_SCHEMA, TRANSFER_CREATE_SCHEMA } from "./payment-native.schema"
import { paymentFailureOf, paymentRefusal } from "./payment-refusal.policy"
import { DomainError } from "@modules/platform/errors"

/** The tool names inside the connector (the full id is `nivo.tool.<name>`). */
export const PAYMENT_TOOL = { transferCreate: "payment.transfer.create", creditGet: "payment.credit.get" } as const

/** The generic payment purpose: named by what it does, never by the provider that does it. */
export const PAYMENT_MANIFEST: ToolManifest = {
    key: "payment-instruction",
    namespace: "nivo.tool",
    name: "Payment instruction",
    contractVersion: "payment-native@1",
    tools: [
        {
            name: PAYMENT_TOOL.transferCreate,
            description:
                "The bank-transfer instruction for an amount and a content into the workspace's receiving account: the QR image and the account details a payer needs. It only composes the instruction; it moves no money, records no order and settles nothing.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: TRANSFER_CREATE_INPUT_SCHEMA,
            argumentSchema: TRANSFER_CREATE_SCHEMA,
            domain: TOOL.paymentTransferCreate,
            internalOnly: true,
        },
        {
            name: PAYMENT_TOOL.creditGet,
            description:
                "One bank move of an attached bank account, by its id (`transactionId`, as the bank trigger names it): its direction (`in` money received, `out` money sent), amount in VND, transfer content, when it happened and, when the bank gave them, its account and bank reference. Any bank feed answers the same shape. Answers `not_found` for an id the chosen account does not hold.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: CREDIT_GET_INPUT_SCHEMA,
            argumentSchema: CREDIT_GET_SCHEMA,
            domain: TOOL.paymentCreditGet,
            internalOnly: true,
        },
    ],
}

/** The answer: only the members the provider gave. */
const answerOf = (instruction: TransferInstruction): ToolJson => ({
    ...(instruction.qrImageUrl === undefined ? {} : { qrImageUrl: instruction.qrImageUrl }),
    ...(instruction.qrPayload === undefined ? {} : { qrPayload: instruction.qrPayload }),
    ...(instruction.bankName === undefined ? {} : { bankName: instruction.bankName }),
    ...(instruction.bankCode === undefined ? {} : { bankCode: instruction.bankCode }),
    accountNumber: instruction.accountNumber,
    ...(instruction.accountHolder === undefined ? {} : { accountHolder: instruction.accountHolder }),
    content: instruction.content,
    amountVnd: instruction.amountVnd,
    ...(instruction.expiresAt === undefined ? {} : { expiresAt: instruction.expiresAt }),
    ...(instruction.providerRef === undefined ? {} : { providerRef: instruction.providerRef }),
})

@Injectable()
/**
 * `nivo.tool.payment.transfer.create`: the transfer instruction of the account the tool runner handed (never a silent pick: no account
 * handed is refused `not_connected`), made by the port its provider registered. It is a READ by what its adapters do: the SePay adapter
 * composes the QR address from the connection's own receiving details and calls nothing, so nothing is created anywhere. A provider
 * whose API CREATES something at the provider (a payment link with its own order code) does not fit this tool.
 */
export class PaymentNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = PAYMENT_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly instructions: PaymentInstructionRegistryService,
        @Optional() private readonly rows?: AccountDataReadService,
        @Optional() private readonly types?: AccountDataTypesService,
    ) {}

    /** Runs the tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        if (tool === PAYMENT_TOOL.creditGet) return this.credit(workspaceId, args, caller)
        if (tool !== PAYMENT_TOOL.transferCreate) throw unknownTool(tool)
        try {
            return answerOf(await this.transfer(workspaceId, args, caller))
        } catch (cause) {
            const failure = paymentFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    /**
     * One bank move of the account the runner handed, read from its raw row by the PROVIDER'S id of the move (`transactionId`: the key the
     * feed's intake kept the row under, and the id the bank trigger's event carries as `data.transactionId`, ruling R51 item 2): the row
     * type of the account's provider whose purpose is the bank-move one, the row of that key ON the handed account (a move of any other
     * account, or of another workspace, is `not_found`). The answer's `id` is the same provider id, so one id form runs end to end. Read
     * only. An app without the account store answers the tool as unknown.
     */
    private async credit(workspaceId: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        const { rows, types } = this
        if (rows === undefined || types === undefined) throw unknownTool(PAYMENT_TOOL.creditGet)
        const asked = argumentsOf(PAYMENT_TOOL.creditGet, CREDIT_GET_SCHEMA, args)
        if (caller.connectionId === undefined) throw paymentRefusal("not_connected")
        const connection = await this.connections.find(workspaceId, caller.connectionId)
        if (connection === null) throw paymentRefusal("not_connected")
        const type = types.all().find((one) => one.provider === connection.provider && one.purpose === BANK_TRANSACTION_PURPOSE)
        if (type === undefined) throw paymentRefusal("not_found")
        const row = await rows.get(connection.id, type.name, asked.transactionId)
        if (row === null) throw paymentRefusal("not_found")
        const credit = creditOf(asked.transactionId, row.value, row.occurredAt)
        if (credit === null) throw paymentRefusal("not_found")
        return { ...credit }
    }

    private async transfer(workspaceId: string, args: ToolJson, caller: NativeCaller): Promise<TransferInstruction> {
        const asked = argumentsOf(PAYMENT_TOOL.transferCreate, TRANSFER_CREATE_SCHEMA, args)
        if (caller.connectionId === undefined) throw paymentRefusal("not_connected")
        const connection = await this.connections.find(workspaceId, caller.connectionId)
        const port = connection === null ? undefined : this.instructions.portFor(connection)
        if (connection === null || port === undefined) throw paymentRefusal("not_connected")
        return port.transfer(connection, { amountVnd: asked.amountVnd, content: asked.content })
    }
}
