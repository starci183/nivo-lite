import assert from "node:assert/strict"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { LiteWorld } from "../../world/lite-world.service"
import { CHAT_ENTITY, MESSAGE_ENTITY } from "./chat-record-types.builder"

/** What opens a customer's conversation in a scene: the agent that speaks, the channel and the customer on it. */
export interface SeededConversation {
    readonly workspaceId: string
    readonly agentId: string
    readonly channel: string
    readonly customerId: string
    readonly visitor: string
    readonly connectionId: string
}

/** The entities handle of a workspace's scene: the same road the app's own records take, no door of the engine's chat records. */
const entitiesOf = (world: LiteWorld, workspaceId: string): EntitiesApi => {
    const engine = world.resolve(EntityEngineService)
    return world.resolve(EntityPortsService).entitiesApi((use) => engine.scoped(workspaceId, use), "action")
}

/**
 * Puts a customer's conversation into a scene, as the chatbot's own hear step opens one (one per channel, connection and customer); the
 * engine's chat doors no longer open conversations. Answers the conversation id.
 */
export const seedConversation = async (world: LiteWorld, input: SeededConversation): Promise<string> => {
    const written = await entitiesOf(world, input.workspaceId).ensure(CHAT_ENTITY, "channel_external", {
        channel: input.channel,
        connectionId: input.connectionId,
        externalId: input.customerId,
        name: input.visitor,
        agentId: input.agentId,
    })
    assert(written.ok, "The scene conversation must be stored")
    return written.row.id
}

/** Puts one line the customer wrote into a scene conversation, linked to it, and answers the line's id. */
export const seedCustomerLine = async (
    world: LiteWorld,
    workspaceId: string,
    conversationId: string,
    text: string,
    channelRef: string | null = null,
): Promise<string> => {
    const written = await entitiesOf(world, workspaceId).insert(
        MESSAGE_ENTITY,
        { conversationId, role: "user", text, sentAt: new Date().toISOString(), channelRef, inReplyTo: null },
        { conversation: conversationId },
    )
    assert(written.ok, "The scene customer line must be stored")
    return written.row.id
}

/** The name a scene conversation shows for its customer, or null when the customer never wrote. */
export const seededNameOf = async (
    world: LiteWorld,
    workspaceId: string,
    channel: string,
    connectionId: string,
    customerId: string,
): Promise<string | null> => {
    const page = await entitiesOf(world, workspaceId).list({
        from: CHAT_ENTITY,
        select: ["name"],
        where: q.and(q.eq("channel", channel), q.eq("connectionId", connectionId), q.eq("externalId", customerId)),
        order: [["id", "asc"]],
        page: { size: 1 },
    })
    const name = page.rows[0]?.row.data["name"]
    return typeof name === "string" ? name : null
}

/** One line of a scene conversation, as the chatbot's own record holds it. */
export interface SeededLine {
    readonly role: string
    readonly text: string
}

/** The lines a scene conversation holds, oldest first: read through the records road, the engine's chat doors keep no transcript. */
export const seededLinesOf = async (world: LiteWorld, workspaceId: string, conversationId: string): Promise<ReadonlyArray<SeededLine>> => {
    const page = await entitiesOf(world, workspaceId).list({
        from: MESSAGE_ENTITY,
        select: ["role", "text", "sentAt"],
        where: q.eq("conversationId", conversationId),
        order: [["sentAt", "asc"]],
        page: { size: 100 },
    })
    return page.rows.map(({ row }) => ({ role: String(row.data["role"] ?? ""), text: String(row.data["text"] ?? "") }))
}
