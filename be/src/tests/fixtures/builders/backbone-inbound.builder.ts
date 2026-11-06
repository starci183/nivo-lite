import { builder } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import type { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import { moduleInstallationsEntities } from "@modules/domain/module-installations"
import type { ConnectionsService } from "@modules/domain/connections"
import type { AgentTriggersService } from "@modules/domain/agent-work"
import type { GraphDocument } from "@modules/domain/agent-graphs"
import { nodeOf } from "./agent-graph.builder"
import { persistGraph, persistGraphTenant } from "./agent-graph-world.builder"
import type { GraphTenant } from "./agent-graph-world.builder"

const InstallationEntity: (typeof moduleInstallationsEntities)[0] = moduleInstallationsEntities[0]

/** Actual catalogue action: an untrusted inbound source must request approval before recording a receipt. */
export const INBOUND_ACTION = "record_receivable_payment"
export const INBOUND_EVENT = "payment.received"
export const INBOUND_CALL_NODE = "read-payment-request"
export const INBOUND_ACTION_NODE = "request-receipt"
export const INBOUND_HOLDING_REPLY = "A person needs to check this payment before I can confirm it."
export const INBOUND_QUESTION = "Please check this payment before confirming it."

const graphNodeOf = builder<GraphDocument["nodes"][number]>({ ...nodeOf() })

/** Both registered request doors reach the same published business action; customer messages have no payment contract. */
export const INBOUND_GRAPH: GraphDocument = {
    nodes: [
        graphNodeOf({
            key: "payment-arrived",
            kind: "trigger",
            step: "event",
            title: "A payment event arrives",
            trigger: { eventTypes: [INBOUND_EVENT], sources: ["generic_webhook"] },
            next: [INBOUND_CALL_NODE],
        }),
        graphNodeOf({
            key: "colleague-tagged",
            kind: "trigger",
            step: "tag",
            title: "A colleague asks",
            trigger: { eventTypes: ["tag"], sources: ["tag"] },
            next: [INBOUND_CALL_NODE],
        }),
        graphNodeOf({
            key: INBOUND_CALL_NODE,
            step: "call",
            title: "Read the payment request",
            next: [INBOUND_ACTION_NODE],
        }),
        graphNodeOf({
            key: INBOUND_ACTION_NODE,
            step: "write",
            title: "Request a receipt",
            action: INBOUND_ACTION,
            next: ["finish"],
        }),
        graphNodeOf({ key: "finish", kind: "output", step: "stop", title: "Finish", next: [] }),
    ],
    rights: [],
    contracts: [
        {
            intent: INBOUND_ACTION,
            task: "Request a receipt; the owner must verify the payment.",
            limits: [],
            sources: [],
        },
    ],
}

/** The tenant and the real customer message the runtime-outage proof answers; the conversation and the message exist once the scene is seeded. */
export interface InboundIdentity extends GraphTenant {
    readonly conversationId: string
    readonly messageId: string
}

/** The chat records the scene seeds its conversation and customer message through. */
export interface InboundChat {
    /** The conversations of the chat records. */
    readonly conversations: ChatConversationsService
    /** The messages of the chat records. */
    readonly messages: ChatMessagesService
}

/** The scene a seeded world holds: empty until it is seeded, replaced by every seed. */
export interface InboundSceneHolder {
    /** The scene the last seed made, or null before any. */
    current: InboundScene | null
}

/** The ids of the website visitor and of the connection the scene's conversation is opened for. */
export interface InboundVisitor {
    /** The visitor's id on the channel. */
    readonly customerId: string
    /** The connection the visitor came in on. */
    readonly connectionId: string
}

/** The created endpoint and its per-seed signing identity, retained only by the test world's signing fake, with the chat the scene opened. */
export interface InboundScene {
    /** The real sealed connection used by the intake proof. */
    readonly endpoint: string
    /** An ephemeral per-seed key shared only with the signing fake. */
    readonly signingKey: string
    /** The record of the customer conversation. */
    readonly conversationId: string
    /** The record of the customer message waiting for its answer. */
    readonly messageId: string
}

/** Seeds a published, installed graph and an actual website conversation as chat records; every service under test reads them. */
export const persistInboundScene = async (
    manager: EntityManager,
    who: GraphTenant,
    connections: ConnectionsService,
    triggers: AgentTriggersService,
    chat: InboundChat,
    visitor: InboundVisitor,
    signingKey: string,
): Promise<InboundScene> => {
    await persistGraphTenant(manager, who)
    const installationId = await persistGraph(manager, who, INBOUND_GRAPH, "enforced")
    await manager.update(
        InstallationEntity,
        { id: installationId },
        { settings: { holdingMessage: INBOUND_HOLDING_REPLY } },
    )
    const met = await chat.conversations.meet({
        workspaceId: who.workspaceId,
        agentId: who.agentId,
        channel: "website",
        customerId: visitor.customerId,
        visitor: "Lan",
        connectionId: visitor.connectionId,
    })
    const heard = await chat.messages.storeCustomer(who.workspaceId, met.conversation.id, INBOUND_QUESTION, null, null)
    const endpoint = await connections.create({
        workspaceId: who.workspaceId,
        createdBy: who.userId,
        provider: "webhook",
        name: "Proof webhook",
        status: "connected",
        environment: "test",
        meta: {},
        secret: { plain: signingKey, webhookSecret: signingKey },
    })
    await triggers.save(who.userId, {
        workspaceId: who.workspaceId,
        agentId: who.agentId,
        triggerId: null,
        kind: "event",
        preset: null,
        atTime: null,
        timeZone: null,
        eventName: INBOUND_EVENT,
        probeKey: null,
        enabled: true,
        sources: ["generic_webhook"],
    })
    return { endpoint, signingKey, conversationId: met.conversation.id, messageId: heard.id }
}

/** External model text at the real parser boundary; no successful handler or business result is scripted into the app. */
export const receiptTextOf = (amount = 3_500_000): string =>
    JSON.stringify({
        intent: INBOUND_ACTION,
        result: {
            action: INBOUND_ACTION,
            fields: { amount_vnd: amount },
            summary: "A payment receipt needs verification",
            reply: "An owner must verify the receipt.",
        },
    })

type PaymentAmountsShape = {
    name: string
    amount: number
}

/** Images and typed amounts are unverified evidence: both stay requests rather than payment confirmations. */
export const PAYMENT_AMOUNTS: Array<PaymentAmountsShape> = [
    { name: "3tr5", amount: 3_500_000 },
    { name: "17tr5", amount: 17_500_000 },
]

/** These prospective actions have no offered contract. Picking one must leave an invalid-output trace and no effect. */
export const UNSUPPORTED_INTENTS: Array<string> = ["confirm_payment", "refund"]
