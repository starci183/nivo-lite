import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectCall, EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import {
    TOOL,
    isRefusal,
    orderCardOf,
    paymentQrCreateEffect,
    paymentQrTextOf,
    refusalOf,
    transferContentOf,
} from "@nivo-lite/blocks-core"
import type { EffectFact, EffectFacts } from "@nivo-lite/blocks-core"
import { WorkspacePaymentAccountService, bankDisplayNameOf } from "@modules/domain/channel-connections"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { PaymentInstructionRegistryService } from "@modules/domain/provider-registry"
import { SalesEffectsError, SalesEffectsErrorCode } from "./errors/sales-effects.error"
import { payableOrderOf } from "./payment-qr.policy"

/** The most catalogue items read to find the photos of the order card. */
const CATALOGUE_ROWS = 500

/** A message the back end composed from the records: the words, the pictures and the order card of the stored line. */
interface ComposedSend {
    /** The conversation. */
    readonly conversationId: string
    /** The words. */
    readonly text: string
    /** The pictures, each with the words under it. */
    readonly images: ReadonlyArray<{ readonly url: string; readonly caption: string }>
    /** The order the message is about. */
    readonly order: ReturnType<typeof orderCardOf>
}

/** The customer-send executor when it also takes a message the back end composed (pictures and an order card that no caller may type). */
interface ComposingExecutor extends NodeEffectExecutor {
    /** Sends a composed message under the same rules as an answer. */
    composed(turn: NodeTurn, send: ComposedSend, call: EffectCall): Promise<SubjectRef>
}

/** The plain values (text, number, true or false, null) of the facts a refusal carried; anything else is left out. */
const plainFactsOf = (facts: Readonly<Record<string, unknown>> | undefined): EffectFacts =>
    Object.fromEntries(
        Object.entries(facts ?? {}).filter(
            (entry): entry is [string, string | number | boolean | null] =>
                entry[1] === null || ["string", "number", "boolean"].includes(typeof entry[1]),
        ),
    )

const composes = (executor: NodeEffectExecutor): executor is ComposingExecutor =>
    "composed" in executor && typeof executor.composed === "function"

@Injectable()
/**
 * The executor of `payment.qr-create`: a step's agent names a confirmed order, and everything with money in it happens here, from the
 * records. It reads the order (refused unless it is confirmed and has a total), the account of the workspace's bank feed and the QR its
 * provider draws for the order's amount and transfer content, sends the customer the payment details with the QR and the order card in
 * the conversation of the turn, and asks the engine to look again for a credit that arrived before the code (`payment.rematch`). When to
 * remind the customer is not the tool's: the step that sends the QR arms the reminders from the Sales policy. The caller types no
 * amount, account or transfer content, and reads them back as facts. A refusal (no order, an order that cannot be paid yet, no bank account, no conversation) is a fact, and
 * nothing is sent. A send the customer-send rules refuse (a person holds the conversation, the window is closed, ...) is the refusal
 * `send_refused` with the send's reason and facts: the QR is not reported as sent, and no re-match is asked for. The message is stored once under the order's own key, so a step that runs again sends no second QR.
 */
export class PaymentQrEffectsService implements OnModuleInit {
    constructor(
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() private readonly accounts?: WorkspacePaymentAccountService,
        @Optional() private readonly providers?: PaymentInstructionRegistryService,
    ) {}

    /** Registers the executor when the app hosts graph nodes. */
    onModuleInit(): void {
        this.registry?.addExecutor({
            effect: TOOL.paymentQrCreate,
            execute: (turn, payload, call) => this.create(turn, payload, call),
        })
    }

    private async create(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<EffectFact> {
        const given = paymentQrCreateEffect.payload.safeParse(payload)
        if (!given.success || this.registry === undefined) {
            throw new SalesEffectsError({ code: SalesEffectsErrorCode.InvalidPayload })
        }
        const { orderId } = given.data
        const [row] = await this.rows(turn, "order", ["orderNo", "amountVnd", "status", "items", "note", "deliveryAddress"], orderId)
        if (row === undefined) return refusalOf("order_missing")
        const order = payableOrderOf(row)
        if ("refused" in order) return refusalOf(order.refused, order.facts)
        if (turn.conversationId === null) return refusalOf("no_conversation", { orderNo: order.orderNo })
        const account = (await this.accounts?.accountOf(turn.workspaceId)) ?? null
        const provider = account === null ? undefined : this.providers?.of(account.provider)
        if (account === null || provider === undefined) {
            return refusalOf("no_payment_account", { orderNo: order.orderNo, amountVnd: order.amountVnd })
        }
        const transferContent = transferContentOf(order.orderNo)
        const qrUrl = provider.qrUrl(account, { orderNo: order.orderNo, amountVnd: order.amountVnd, transferContent })
        const text = paymentQrTextOf(
            {
                bankName: bankDisplayNameOf(account.bankCode),
                bankCode: account.bankCode,
                accountNumber: account.accountNumber,
                accountHolder: account.holder ?? "",
                qrUrl,
            },
            order,
            transferContent,
            turn.locale,
        )
        const card = orderCardOf(
            {
                orderNo: order.orderNo,
                amountVnd: order.amountVnd,
                items: order.items,
                address: order.address,
                paid: false,
            },
            await this.photos(turn),
            turn.locale,
        )
        const sent = await this.send(
            turn,
            {
                conversationId: turn.conversationId,
                text,
                images: [{ url: qrUrl, caption: transferContent }],
                order: card,
            },
            { key: `${call.key}:send`, dedupeKey: `payment-request:${orderId}` },
        )
        if (isRefusal(sent)) {
            return refusalOf("send_refused", {
                ...plainFactsOf(sent.facts),
                reason: sent.id,
                orderNo: order.orderNo,
                amountVnd: order.amountVnd,
            })
        }
        await this.registry
            .executorOf(TOOL.paymentRematch)
            .execute(turn, { orderId }, { key: `${call.key}:rematch`, dedupeKey: `payment-rematch:${orderId}` })
        return {
            kind: sent.kind,
            id: sent.id,
            facts: { orderNo: order.orderNo, amountVnd: order.amountVnd, transferContent, qrUrl },
        }
    }

    /**
     * Sends the composed message through the customer-send executor, so the rules of who may speak hold. The executor takes the QR as a
     * picture and the order card when it accepts a composed message; one that does not gets the words (which carry the QR link) and the
     * order by its id.
     */
    private async send(turn: NodeTurn, send: ComposedSend, call: EffectCall): Promise<SubjectRef> {
        const executor = this.registry?.executorOf(TOOL.customerMessageSend)
        if (executor === undefined) throw new SalesEffectsError({ code: SalesEffectsErrorCode.WriteRefused })
        return composes(executor)
            ? await executor.composed(turn, send, call)
            : await executor.execute(turn, { conversationId: send.conversationId, text: send.text }, call)
    }

    /** The catalogue's names and photos, for the order card. */
    private async photos(
        turn: NodeTurn,
    ): Promise<ReadonlyArray<{ readonly name: string; readonly imageUrl: string | null }>> {
        const rows = await this.rows(turn, "catalogue-item", ["name", "imageUrl"])
        return rows.map((row) => ({
            name: typeof row.name === "string" ? row.name : "",
            imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : null,
        }))
    }

    /** The rows of a data kind of the workspace: the one of an id, or the first of the kind. */
    private async rows(
        turn: NodeTurn,
        kind: string,
        fields: ReadonlyArray<string>,
        id?: string,
    ): Promise<ReadonlyArray<NodeRow>> {
        if (this.registry === undefined) return []
        const query = id === undefined ? { fields, limit: CATALOGUE_ROWS } : { where: { id }, fields, limit: 1 }
        return await this.registry.portOf(kind).read(turn, query, "workspace")
    }
}
