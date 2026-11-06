import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { isHeldByPerson } from "@nivo-lite/blocks-core/rules/chatbot"
import type { SubjectRef } from "@nivo-lite/agent-sdk/node"
import { q } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { handledByOf } from "./chat-node-ports.policy"
import type { ProposeReply } from "./chat-node-ports.policy"
import { proposeReplySchema } from "./chat-node-ports.schema"
import { ChatNodePortsError, ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"

const EFFECT = "chat-message.propose"
const CONVERSATION = "chat.conversation"
const MESSAGE = "chat.message"

@Injectable()
/**
 * The executor of the `chat-message.propose` effect on the entity engine: it stores the reply the AI drafted as a `chat.message` of the
 * conversation with the status `proposed` (role agent, author ai), sending nothing: a person approves it with `chatbot.approve-and-send`.
 * A conversation holds at most one proposed line (the partition's unique index), so a new draft, or a retry of the same one, replaces
 * the words of the line that waits. It speaks only in the conversation of the running turn and never in one a person holds.
 */
export class ChatMessageProposeExecutorService implements OnModuleInit {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor when the app hosts graph nodes. */
    onModuleInit(): void {
        this.registry?.addExecutor({
            effect: EFFECT,
            execute: async (turn, payload) => {
                const parsed = proposeReplySchema.safeParse(payload)
                if (!parsed.success) throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.InvalidPayload })
                return await this.proposeReply(turn, parsed.data)
            },
        })
    }

    /** Stores or replaces the proposed line of the conversation and answers it as the subject. */
    async proposeReply(turn: NodeTurn, draft: ProposeReply): Promise<SubjectRef> {
        const { conversationId, text } = draft
        if (turn.conversationId !== null && turn.conversationId !== conversationId)
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.WrongConversation })
        const at = this.clock.now().toISOString()
        return await this.engine.scoped(turn.workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const conversation = await api.get(CONVERSATION, conversationId)
            if (conversation === null)
                throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.ConversationNotFound })
            if (isHeldByPerson(handledByOf(conversation.data)))
                throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.HeldByPerson })
            const waiting = await api.list({
                from: MESSAGE,
                select: ["text"],
                where: q.and(q.eq("conversationId", conversationId), q.eq("status", "proposed")),
                order: [
                    ["sentAt", "desc"],
                    ["id", "desc"],
                ],
                page: { size: 1 },
            })
            const [line] = waiting.rows
            const written =
                line === undefined
                    ? await api.insert(
                          MESSAGE,
                          { conversationId, role: "agent", text, sentAt: at, authorKind: "ai", status: "proposed" },
                          { conversation: conversationId },
                      )
                    : await api.update(MESSAGE, line.row.id, line.row.version, { text, sentAt: at })
            if (!written.ok) throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.ProposalRefused })
            return { kind: "message", id: written.row.id }
        })
    }
}
