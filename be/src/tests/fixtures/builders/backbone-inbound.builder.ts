import { builder } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { agentConversationsEntities } from "@modules/domain/agent-conversations"
import { agentMessagesEntities } from "@modules/domain/agent-messages"
import { moduleInstallationsEntities } from "@modules/domain/module-installations"
import type { ConnectionsService } from "@modules/domain/connections"
import type { AgentTriggersService } from "@modules/domain/agent-work"
import type { GraphDocument } from "@modules/domain/agent-graphs"
import { nodeOf } from "./agent-graph.builder"
import { persistGraph, persistGraphTenant } from "./agent-graph-world.builder"
import type { GraphTenant } from "./agent-graph-world.builder"

const ConversationEntity: (typeof agentConversationsEntities)[0] = agentConversationsEntities[0]
const MessageEntity: (typeof agentMessagesEntities)[0] = agentMessagesEntities[0]
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

/** The tenant and the real customer message the runtime-outage proof answers. */
export interface InboundIdentity extends GraphTenant {
    readonly conversationId: string
    readonly messageId: string
}

/** The created endpoint and its per-seed signing identity, retained only by the test world's signing fake. */
export interface InboundEndpoint {
    /** The real sealed connection used by the intake proof. */
    readonly endpoint: string
    /** An ephemeral per-seed key shared only with the signing fake. */
    readonly signingKey: string
}

/** Seeds a published, installed graph and an actual website conversation; every service under test reads these rows. */
export const persistInboundScene = async (
    manager: EntityManager,
    who: InboundIdentity,
    connections: ConnectionsService,
    triggers: AgentTriggersService,
    signingKey: string,
): Promise<InboundEndpoint> => {
    await persistGraphTenant(manager, who)
    const installationId = await persistGraph(manager, who, INBOUND_GRAPH, "enforced")
    await manager.transaction(async (tx) => {
        await tx.update(
            InstallationEntity,
            { id: installationId },
            { settings: { holdingMessage: INBOUND_HOLDING_REPLY } },
        )
        await tx.insert(ConversationEntity, {
            id: who.conversationId,
            workspaceId: who.workspaceId,
            agentId: who.agentId,
            kind: "customer",
            channel: "website",
            visitorName: "Lan",
            installationId,
        })
        await tx.insert(MessageEntity, {
            id: who.messageId,
            workspaceId: who.workspaceId,
            conversationId: who.conversationId,
            role: "user",
            body: INBOUND_QUESTION,
        })
    })
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
    return { endpoint, signingKey }
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
