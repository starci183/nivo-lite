import { TOOL } from "@nivo-lite/agent-sdk/names"
import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import {
    PaymentLinkRegistryService,
    type PaymentLink,
    type PaymentLinkPort,
    type PaymentLinkRef,
    type PaymentLinkState,
} from "@modules/domain/provider-registry"
import {
    LINK_CANCEL_INPUT_SCHEMA,
    LINK_CANCEL_SCHEMA,
    LINK_CREATE_INPUT_SCHEMA,
    LINK_CREATE_SCHEMA,
    LINK_GET_INPUT_SCHEMA,
    LINK_GET_SCHEMA,
} from "./payment-link.schema"
import { paymentFailureOf, paymentRefusal } from "./payment-refusal.policy"
import { DomainError } from "@modules/platform/errors"

/** The tool names inside the connector (the full id is `nivo.tool.<name>`). */
export const PAYMENT_LINK_TOOL = { create: "payment.link.create", get: "payment.link.get", cancel: "payment.link.cancel" } as const

/** The payment-link purpose: named by what it does, never by the provider that does it; its own purpose, not the transfer instruction. */
export const PAYMENT_LINK_MANIFEST: ToolManifest = {
    key: "payment-link",
    namespace: "nivo.tool",
    name: "Payment link",
    contractVersion: "payment-link-native@1",
    tools: [
        {
            name: PAYMENT_LINK_TOOL.create,
            description:
                "Creates a hosted payment LINK at the payment provider for an amount and a description, under the provider's own order code, and answers its id, order code, checkout address and QR payload. It creates something at the provider but moves no money, records no order and settles nothing; the payer pays on the provider's page. Not a bank-transfer instruction (that is `payment.transfer.create`).",
            scope: "write",
            defaultMode: "ask",
            inputSchema: LINK_CREATE_INPUT_SCHEMA,
            argumentSchema: LINK_CREATE_SCHEMA,
            domain: TOOL.paymentLinkCreate,
            internalOnly: true,
        },
        {
            name: PAYMENT_LINK_TOOL.get,
            description:
                "One payment link of the chosen account, by its id or its order code: its status word, amount, amount paid and remaining when the provider says. Answers `not_found` for a link the account does not hold.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: LINK_GET_INPUT_SCHEMA,
            argumentSchema: LINK_GET_SCHEMA,
            domain: TOOL.paymentLinkGet,
            internalOnly: true,
        },
        {
            name: PAYMENT_LINK_TOOL.cancel,
            description:
                "Cancels a payment link of the chosen account, by its id or its order code, with an optional reason. A link the provider cannot cancel is refused `rejected`.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: LINK_CANCEL_INPUT_SCHEMA,
            argumentSchema: LINK_CANCEL_SCHEMA,
            domain: TOOL.paymentLinkCancel,
            internalOnly: true,
        },
    ],
}

/** The answer of a create: only the members the provider gave, and the caller's own reference untouched. */
const createdOf = (link: PaymentLink, reference: string | undefined): ToolJson => ({
    linkId: link.linkId,
    orderCode: link.orderCode,
    checkoutUrl: link.checkoutUrl,
    ...(link.qrPayload === undefined ? {} : { qrPayload: link.qrPayload }),
    amountVnd: link.amountVnd,
    description: link.description,
    status: link.status,
    ...(link.expiresAt === undefined ? {} : { expiresAt: link.expiresAt }),
    ...(reference === undefined ? {} : { reference }),
})

/** The answer of a get or a cancel: only the members the provider gave. */
const stateOf = (state: PaymentLinkState): ToolJson => ({
    linkId: state.linkId,
    orderCode: state.orderCode,
    amountVnd: state.amountVnd,
    ...(state.amountPaidVnd === undefined ? {} : { amountPaidVnd: state.amountPaidVnd }),
    ...(state.amountRemainingVnd === undefined ? {} : { amountRemainingVnd: state.amountRemainingVnd }),
    status: state.status,
    ...(state.createdAt === undefined ? {} : { createdAt: state.createdAt }),
    ...(state.canceledAt === undefined ? {} : { canceledAt: state.canceledAt }),
    ...(state.cancellationReason === undefined ? {} : { cancellationReason: state.cancellationReason }),
})

/** What a get or cancel names: a link id or an order code. */
interface LinkRefAsked {
    /** The provider link id. */
    readonly linkId?: string | undefined
    /** The order code. */
    readonly orderCode?: number | undefined
}

/** The link a get or cancel names: by id or by order code (the schema proves exactly one is given). */
const refOf = (asked: LinkRefAsked): PaymentLinkRef =>
    asked.linkId === undefined ? { orderCode: asked.orderCode ?? 0 } : { linkId: asked.linkId }

@Injectable()
/**
 * `nivo.tool.payment.link.create / get / cancel`: a hosted payment link of the account the tool runner handed (never a silent pick: no
 * account handed is refused `not_connected`), made by the port its provider registered. Create and cancel WRITE at the provider (the
 * node's declared mode applies); the tool runner keeps the answer under the call's key, so the adapter is called once per key and a replay
 * returns the kept answer (a timed-out create proves `unknown` and stops for a person, it is never sent again by itself).
 */
export class PaymentLinkNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = PAYMENT_LINK_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly links: PaymentLinkRegistryService,
    ) {}

    /** Runs the tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        try {
            switch (tool) {
                case PAYMENT_LINK_TOOL.create:
                    return await this.create(workspaceId, args, caller)
                case PAYMENT_LINK_TOOL.get:
                    return await this.get(workspaceId, args, caller)
                case PAYMENT_LINK_TOOL.cancel:
                    return await this.cancel(workspaceId, args, caller)
                default:
                    throw unknownTool(tool)
            }
        } catch (cause) {
            const failure = paymentFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    private async create(workspaceId: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        const asked = argumentsOf(PAYMENT_LINK_TOOL.create, LINK_CREATE_SCHEMA, args)
        const { connection, port } = await this.portOf(workspaceId, caller)
        const link = await port.create(connection, {
            amountVnd: asked.amountVnd,
            description: asked.description,
            returnUrl: asked.returnUrl,
            cancelUrl: asked.cancelUrl,
            ...(asked.expiresAt === undefined ? {} : { expiresAt: asked.expiresAt }),
        })
        return createdOf(link, asked.reference)
    }

    private async get(workspaceId: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        const asked = argumentsOf(PAYMENT_LINK_TOOL.get, LINK_GET_SCHEMA, args)
        const { connection, port } = await this.portOf(workspaceId, caller)
        return stateOf(await port.get(connection, refOf(asked)))
    }

    private async cancel(workspaceId: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        const asked = argumentsOf(PAYMENT_LINK_TOOL.cancel, LINK_CANCEL_SCHEMA, args)
        const { connection, port } = await this.portOf(workspaceId, caller)
        return stateOf(await port.cancel(connection, refOf(asked), asked.reason))
    }

    /** The handed account and the port its provider registered; no account handed, none found or no port is `not_connected`. */
    private async portOf(workspaceId: string, caller: NativeCaller): Promise<{ readonly connection: ConnectionRecord; readonly port: PaymentLinkPort }> {
        if (caller.connectionId === undefined) throw paymentRefusal("not_connected")
        const connection = await this.connections.find(workspaceId, caller.connectionId)
        const port = connection === null ? undefined : this.links.of(connection.provider)
        if (connection === null || port === undefined) throw paymentRefusal("not_connected")
        return { connection, port }
    }
}
