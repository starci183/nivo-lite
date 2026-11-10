import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { LATEST_VERSION, WORKFLOW_CALL_MEMBER, WORKFLOW_PARAMS_MEMBER } from "@nivo-lite/agent-sdk/graph"
import { TEAM_CHAT_LINES_MAX, TEAM_CHAT_MODULES, TEAM_CHAT_WORKFLOW_KEY } from "@nivo-lite/blocks-core"
import type { TeamChatIntent, TeamChatLine, TeamChatRoom } from "@nivo-lite/blocks-core"
import { AgentTagService } from "@modules/domain/agent-work"
import { ThreadRunsService } from "@modules/domain/agent-threads"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentCard } from "@modules/domain/agents"
import { BrainChangeRequestsService } from "@modules/domain/brain-facts"
import { TeamChatCardsService, TeamChatRoomsService, TeamChatStoreService } from "@modules/domain/team-chat"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ChatTurnLimiterService } from "./chat-turn-limiter.service"
import type {
    AskerSeat,
    CaptureOutcome,
    CaptureRequest,
    HeardReply,
    PersonLineHeard,
    TurnParams,
} from "./team-chat-turns.contracts"
import { TeamChatTurnsLogEvent } from "./team-chat-turns.log-events"
import {
    agentOfDirectKey,
    askedTextOf,
    captureKeyOf,
    captureReasonOf,
    chatTurnNamespaceOf,
    fittedParamsOf,
    mayCapture,
    pauseLineOf,
    standingOf,
    turnKeyOf,
    turnLineOf,
    turnLinesOf,
    turnTargetsOf,
} from "./team-chat-turns.policy"

/** The most members read to find the asker's seat (the same bounded directory the chat's views read). */
const DIRECTORY_MAX = 200

/** The language a chat turn answers in: the team chat keeps none per room, the shop speaks Vietnamese. */
const TEAM_LOCALE = "vi"

/** The listener the team chat calls with every person's new message; it answers the agents whose turn it took. */
export type PersonLineListener = (line: PersonLineHeard) => Promise<ReadonlyArray<string>>

/** The door the team chat opens to its one line listener (W11's `listenLines`). */
interface LineDoor {
    listenLines(listener: PersonLineListener): void
}

const hasLineDoor = (chat: object): chat is LineDoor => typeof Reflect.get(chat, "listenLines") === "function"

/** What a started turn knows of its room, read once for every agent the message is for. */
interface TurnContext {
    readonly asker: AskerSeat
    readonly lines: ReadonlyArray<TeamChatLine>
    readonly replyTo: TeamChatLine | null
}

/** Who asked, with the names of the workspace's people (account id → display name). */
interface Seat {
    readonly asker: AskerSeat
    readonly people: ReadonlyArray<readonly [string, string]>
}

/** What one agent's turn came to, for the team chat (taken or not) and the log. */
type TurnEnd = "started" | "duplicate" | "paused" | "quiet" | "engine_off" | "no_agent" | "not_tagged"

/** The ends after which the old tag path must not run for the agent too: the turn is this router's. */
const TAKEN: ReadonlyArray<TurnEnd> = ["started", "duplicate", "paused", "quiet"]

@Injectable()
/**
 * The team chat turn's router (THE COMMON-ROOM RULE, owner 2026-11-11): a person's message in /chat starts the `team-chat` workflow of
 * the agents it is for, and of no other. A private room with an agent: every message is for that agent. A room of several people:
 * each agent the message names (once, in order), then the agent whose line it replies to. A message that names nobody, an agent's own
 * line, or a reply to a card a person decides on (stop, approval, truth change: their own doors) starts nothing and costs no read and
 * no model call. A turn is a pinned tag (the workflow `team-chat`, latest) carrying the asked words, who asked with their standing,
 * the room's latest lines and the line replied to, so the agent answers with the asker's rights. It runs on threads only: an agent
 * whose module's chat turn is not engaged keeps the old tag path untouched. A room over its rate limit gets one line, then quiet.
 * The router never starts a business workflow: the pin names only `team-chat`.
 */
export class TeamChatTurnsService implements OnModuleInit {
    constructor(
        private readonly tags: AgentTagService,
        private readonly agents: AgentDirectoryService,
        private readonly members: WorkspaceMembersReadService,
        private readonly store: TeamChatStoreService,
        private readonly limiter: ChatTurnLimiterService,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly threads?: ThreadRunsService,
        @Optional() private readonly chat?: TeamChatRoomsService,
        @Optional() private readonly cards?: TeamChatCardsService,
        @Optional() private readonly changes?: BrainChangeRequestsService,
    ) {}

    /** Listens to the team chat's new person lines once the app has started; an app without the chat (or its door) hears nothing. */
    onModuleInit(): void {
        const chat = this.chat
        if (chat !== undefined && hasLineDoor(chat)) chat.listenLines((line) => this.heard(line))
    }

    /**
     * Routes one person's new message: answers the agents whose turn this router took (started, already started, paused or quiet), so
     * the team chat writes no old tag wake for them. A failure starts nothing and never fails the person's message.
     */
    async heard(line: PersonLineHeard): Promise<ReadonlyArray<string>> {
        const targets = turnTargetsOf(line)
        if (targets.agentIds.length === 0) return []
        try {
            return await this.routed(line, targets.agentIds, targets.room)
        } catch (cause) {
            this.logger.error(TeamChatTurnsLogEvent.RouteFailed, cause, { roomId: line.room.id })
            return []
        }
    }

    /**
     * "Ghi vào Second Brain" on a message: the owner or a manager files it as a truth change. With the truth named on the form it is
     * filed at once through the truth graph's change requests (the card waits in the room for the owner; no AI call); without, the agent
     * drafts and files it in a chat turn of intent `capture`.
     */
    async capture(workspaceId: string, userId: string, request: CaptureRequest): Promise<CaptureOutcome> {
        const [message] = await this.store.messagesByIds(workspaceId, [request.messageId])
        const room = message === undefined ? null : await this.store.roomById(workspaceId, message.roomId)
        const visible = room === null ? null : await this.chat?.room(workspaceId, userId, room.id)
        if (message === undefined || room === null || visible == null) return this.captured("not_found")
        if (message.authorKind !== "user") return this.captured("not_person_line")
        const seat = await this.seatOf(workspaceId, userId)
        if (seat === null || !mayCapture(seat.asker.standing)) return this.captured("not_allowed")
        const { asker } = seat
        const agentId = request.agentId ?? agentOfDirectKey(room.directKey)
        if (agentId === null) return this.captured("agent_required")
        const agent = await this.agents.find(workspaceId, agentId)
        if (agent === null) return this.captured("not_found")
        const roomKind: TeamChatRoom = room.kind === "direct" ? "direct" : "common"
        if (request.fact !== null && this.changes !== undefined) {
            const filed = await this.changes.propose(workspaceId, {
                subjectLabel: request.fact.subjectLabel,
                attributeLabel: request.fact.attributeLabel,
                value: request.fact.value,
                unit: request.fact.unit,
                room: roomKind,
                messageId: message.id,
                quote: message.body.slice(0, 500),
                validFrom: request.fact.validFrom,
                validTo: request.fact.validTo,
                reason: captureReasonOf(asker.name, request.fact.value),
                proposedBy: agent.module,
                agentId: agent.id,
                installationId: null,
            })
            return this.captured(filed.outcome)
        }
        const ended = await this.turnOf(
            workspaceId,
            agent,
            { id: message.id, body: message.body, roomId: room.id },
            { room: roomKind, intent: "capture", eventKey: captureKeyOf(message.id, agent.id) },
            () => this.contextOf(workspaceId, room.id, message.id, null, seat),
        )
        if (ended === "engine_off" || ended === "no_agent") return this.captured("engine_off")
        return this.captured(ended === "duplicate" ? "duplicate" : "drafting")
    }

    private captured(outcome: CaptureOutcome): CaptureOutcome {
        this.logger.info(TeamChatTurnsLogEvent.Captured, { outcome })
        return outcome
    }

    /** Starts the turn of each agent in order; the room's context is read once, only when a first turn really starts. */
    private async routed(
        line: PersonLineHeard,
        agentIds: ReadonlyArray<string>,
        room: TeamChatRoom,
    ): Promise<ReadonlyArray<string>> {
        let context: Promise<TurnContext | null> | null = null
        const read = (): Promise<TurnContext | null> => {
            context ??= this.seatOf(line.workspaceId, line.userId).then((seat) =>
                seat === null
                    ? null
                    : this.contextOf(line.workspaceId, line.room.id, line.message.id, line.repliedTo, seat),
            )
            return context
        }
        const taken: Array<string> = []
        for (const agentId of agentIds) {
            const agent = await this.agents.find(line.workspaceId, agentId)
            const ended =
                agent === null
                    ? "no_agent"
                    : await this.turnOf(
                          line.workspaceId,
                          agent,
                          { id: line.message.id, body: line.message.body, roomId: line.room.id },
                          { room, intent: "answer", eventKey: turnKeyOf(line.message.id, agentId) },
                          read,
                      )
            if (TAKEN.includes(ended)) taken.push(agentId)
            this.logger.info(ended === "started" ? TeamChatTurnsLogEvent.TurnStarted : TeamChatTurnsLogEvent.TurnSkipped, {
                agentId,
                roomId: line.room.id,
                code: ended,
            })
        }
        return taken
    }

    /** One agent's turn: on threads only, within the room's limit, as one pinned tag of the person. */
    private async turnOf(
        workspaceId: string,
        agent: AgentCard,
        asked: { readonly id: string; readonly body: string; readonly roomId: string },
        how: { readonly room: TeamChatRoom; readonly intent: TeamChatIntent; readonly eventKey: string },
        read: () => Promise<TurnContext | null>,
    ): Promise<TurnEnd> {
        if (!this.engages(agent.module)) return "engine_off"
        const admission = this.limiter.admit(`${workspaceId}:${asked.roomId}`)
        if (admission === "quiet") return "quiet"
        if (admission === "pause_notice") {
            await this.pause(workspaceId, agent.id, asked.roomId, asked.id)
            return "paused"
        }
        const context = await read()
        if (context === null) return "not_tagged"
        const params: TurnParams = fittedParamsOf({
            roomId: asked.roomId,
            messageId: asked.id,
            text: askedTextOf(asked.body),
            room: how.room,
            intent: how.intent,
            asker: { name: context.asker.name, standing: context.asker.standing },
            lines: context.lines,
            replyTo: context.replyTo,
            locale: TEAM_LOCALE,
        })
        const tagged = await this.tags.tagAgent({
            workspaceId,
            toAgentId: agent.id,
            personId: context.asker.memberId,
            text: params.text,
            subject: `chat-room:${asked.roomId}`,
            locale: TEAM_LOCALE,
            context: {
                [WORKFLOW_CALL_MEMBER]: { workflow: TEAM_CHAT_WORKFLOW_KEY, version: LATEST_VERSION },
                [WORKFLOW_PARAMS_MEMBER]: { ...params },
            },
            eventKey: how.eventKey,
        })
        if (tagged.tagged) return "started"
        return tagged.reason === "duplicate" ? "duplicate" : "not_tagged"
    }

    /** True when the agent's module ships a chat turn and the thread engine runs it. */
    private engages(moduleKey: string): boolean {
        return (
            TEAM_CHAT_MODULES.includes(moduleKey) &&
            this.threads?.engages(chatTurnNamespaceOf(moduleKey, TEAM_CHAT_WORKFLOW_KEY)) === true
        )
    }

    /** The one line an agent says when its room reached the limit; once per window (the limiter says when). */
    private async pause(workspaceId: string, agentId: string, roomId: string, messageId: string): Promise<void> {
        this.logger.warn(TeamChatTurnsLogEvent.RoomPaused, { roomId, agentId })
        const line = pauseLineOf(TEAM_LOCALE)
        await this.cards?.postMessage(workspaceId, {
            authorAgentId: agentId,
            roomId,
            toUserId: null,
            body: line.text,
            key: `chat-pause:${messageId}`,
            agentMessage: JSON.stringify({
                kind: "message.text",
                intent: "notify",
                title: line.title,
                summary: line.text,
                payload: { text: line.text },
            }),
        })
    }

    /**
     * The asker's seat, name and standing, with the names of the workspace's people (the one bounded directory read, as the chat's
     * views read it); null for an account that is no active member of the workspace.
     */
    private async seatOf(workspaceId: string, userId: string): Promise<Seat | null> {
        const rows = await this.members.directory(workspaceId, DIRECTORY_MAX)
        const row = rows.find((one) => one.user_id === userId && one.status === "active")
        return row === undefined
            ? null
            : {
                  asker: { memberId: row.id, name: row.display_name, standing: standingOf(row.role) },
                  people: rows.map((one): [string, string] => [one.user_id, one.display_name]),
              }
    }

    /** The room's latest lines (bounded, named) and the line replied to: two index-served reads and at most one name read. */
    private async contextOf(
        workspaceId: string,
        roomId: string,
        askedId: string,
        repliedTo: HeardReply | null,
        seat: Seat,
    ): Promise<TurnContext> {
        const keys = await this.store.threadKeys(workspaceId, roomId, null, TEAM_CHAT_LINES_MAX + 1, false)
        const stored = await this.store.messagesByIds(
            workspaceId,
            keys.map((key) => key.id),
        )
        const agentIds = [
            ...new Set(
                [...stored.map((one) => (one.authorKind === "agent" ? one.authorId : null)), repliedTo?.authorKind === "agent" ? repliedTo.authorId : null].filter(
                    (id): id is string => id !== null,
                ),
            ),
        ]
        const cards = agentIds.length === 0 ? [] : await this.agents.cardsOf(workspaceId, agentIds)
        const names = new Map<string, string>([
            ...seat.people,
            ...cards.map((card): [string, string] => [card.id, card.name]),
        ])
        return {
            asker: seat.asker,
            lines: turnLinesOf(stored, askedId, names),
            replyTo:
                repliedTo === null
                    ? null
                    : turnLineOf({ ...repliedTo, createdAt: new Date(repliedTo.createdAt) }, names),
        }
    }
}
