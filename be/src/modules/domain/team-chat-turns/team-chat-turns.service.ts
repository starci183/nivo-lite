import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { LATEST_VERSION } from "@nivo-lite/agent-sdk/graph"
import {
    TEAM_CHAT_LINES_MAX,
    TEAM_CHAT_WORKFLOW_KEY,
    type TeamChatIntent,
    type TeamChatLine,
    type TeamChatRoom,
} from "@nivo-lite/agent-sdk/team-chat"
import { AgentWorkflowsService } from "@modules/domain/agent-graphs"
import { callDeliveryOf } from "@modules/domain/agent-schedules/workflow-call-delivery.policy"
import { WORKFLOW_CALL_TRIGGER } from "@modules/domain/agent-schedules/workflow-call.trigger"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { AgentDirectoryService, AgentViewScopeService, type AgentCard } from "@modules/domain/agents"
import { BrainChangeRequestsService } from "@modules/domain/brain-facts"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import {
    TeamChatCardsService,
    TeamChatRoomsService,
    TeamChatStoreService,
    type HeardReply,
    type PersonLineHeard,
    type PersonLineListener,
} from "@modules/domain/team-chat"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { ChatFallbackService } from "./chat-fallback.service"
import { ChatTurnLimiterService } from "./chat-turn-limiter.service"
import type { AskerSeat, CaptureOutcome, CaptureRequest, TurnParams, UnroutedTurn } from "./team-chat-turns.contracts"
import { TeamChatTurnsLogEvent } from "./team-chat-turns.log-events"
import {
    agentOfDirectKey,
    askedTextOf,
    captureKeyOf,
    captureReasonOf,
    fittedParamsOf,
    mayCapture,
    outsideTurnsOf,
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

/** The door the team chat opens to its one line listener (W11's `listenLines`). */
interface LineDoor {
    listenLines(listener: PersonLineListener): void
}

const hasLineDoor = (chat: object): chat is LineDoor => typeof Reflect.get(chat, "listenLines") === "function"

/** The person's message an agent's turn answers. */
interface AskedLine {
    /** The message. */
    readonly id: string
    /** Its words. */
    readonly body: string
    /** The room it was written in. */
    readonly roomId: string
}

/** How an agent's turn runs: the kind of room, what it was asked for, and the key that makes it once. */
interface TurnHow {
    /** A private room with the agent, or a room of several people. */
    readonly room: TeamChatRoom
    /** What the turn was started for. */
    readonly intent: TeamChatIntent
    /** The idempotency key of the wake. */
    readonly eventKey: string
}

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
type TurnEnd = "started" | "duplicate" | "paused" | "quiet" | "no_chat_turn" | "no_agent" | "not_tagged"

/** The ends after which the old tag path must not run for the agent too: the turn is this router's. */
const TAKEN: ReadonlySet<TurnEnd> = new Set<TurnEnd>(["started", "duplicate", "paused", "quiet"])

/** How one agent's turn ended. */
interface AgentEnd {
    readonly agentId: string
    readonly ended: TurnEnd
}

/** The turns that did not start, with the code of each; a turn this router took is none. */
const unroutedOf = (ends: ReadonlyArray<AgentEnd>): ReadonlyArray<UnroutedTurn> =>
    ends.flatMap(({ agentId, ended }): ReadonlyArray<UnroutedTurn> =>
        ended === "no_chat_turn" || ended === "no_agent" || ended === "not_tagged" ? [{ agentId, code: ended }] : [],
    )

@Injectable()
/**
 * The team chat turn's router (THE COMMON-ROOM RULE, owner 2026-11-11): a person's message in /chat starts the `team-chat` workflow of
 * the agents it is for, and of no other. A private room with an agent: every message is for that agent. A room of several people:
 * each agent the message names (once, in order), then the agent whose line it replies to. A message that names nobody, an agent's own
 * line, or a reply to a card a person decides on (stop, approval, truth change: their own doors) starts nothing and costs no read and
 * no model call. A turn is one workflow call of the one event pipeline (concept triggers rule 13), pinned to the `team-chat` workflow
 * (latest) and delivered for the agent, the asker beside it: the event's data carries the asked words, who asked with their standing,
 * the room's latest lines and the line replied to, so the agent answers with the asker's rights. It runs on threads (the one engine):
 * an agent whose module ships no chat turn (`TEAM_CHAT_MODULES`) keeps the old tag path untouched. A room over its rate limit gets one line, then quiet.
 * The router never starts a business workflow: the pin names only `team-chat`.
 *
 * While the workspace's switch "node rights decide" is ON, a message in /chat may only run the module's own chat workflow: the old tag
 * path (an UNPINNED tag, which the agent's own graph or a workflow woken by a person's tag would answer) is kept shut for every
 * agent the message names. An agent whose turn did not start (no chat turn, no such agent, the tag not written, a router failure,
 * a message the router starts no turn for) gets no tag at all and the room is told (`ChatFallbackService`). With the switch off the
 * old tag path runs exactly as before.
 */
export class TeamChatTurnsService implements OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly triggers: ProviderTriggersService,
        private readonly agents: AgentDirectoryService,
        private readonly members: WorkspaceMembersReadService,
        private readonly store: TeamChatStoreService,
        private readonly limiter: ChatTurnLimiterService,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly chat?: TeamChatRoomsService,
        @Optional() private readonly cards?: TeamChatCardsService,
        @Optional() private readonly changes?: BrainChangeRequestsService,
        @Optional() private readonly scopes?: AgentViewScopeService,
        @Optional() private readonly fallback?: ChatFallbackService,
        @Optional() private readonly workflows?: AgentWorkflowsService,
    ) {}

    /** Listens to the team chat's new person lines once the app has started; an app without the chat (or its door) hears nothing. */
    onModuleInit(): void {
        const chat = this.chat
        if (chat !== undefined && hasLineDoor(chat)) chat.listenLines((line) => this.heard(line))
    }

    /**
     * Routes one person's new message: answers the agents whose turn this router took (started, already started, paused or quiet), so
     * the team chat writes no old tag wake for them. A failure starts nothing and never fails the person's message. With the node
     * rights deciding, it answers EVERY agent the message names (the old tag path writes nothing) and tells the room of the turns
     * that did not start.
     */
    async heard(line: PersonLineHeard): Promise<ReadonlyArray<string>> {
        const targets = turnTargetsOf(line)
        if (targets.agentIds.length === 0 && line.agentMentions.length === 0) return []
        const closed = (await this.fallback?.closed(line.workspaceId)) === true
        const outside = closed ? outsideTurnsOf(line.agentMentions, targets.agentIds) : []
        if (targets.agentIds.length === 0) return this.shut(line, [], outside)
        try {
            const ends = await this.routed(line, targets.agentIds, targets.room)
            const taken = ends.filter((end) => TAKEN.has(end.ended)).map((end) => end.agentId)
            return closed ? await this.shut(line, taken, [...unroutedOf(ends), ...outside]) : taken
        } catch (cause) {
            this.logger.error(TeamChatTurnsLogEvent.RouteFailed, cause, { roomId: line.room.id })
            if (!closed) return []
            const failed = targets.agentIds.map((agentId): UnroutedTurn => ({ agentId, code: "route_failed" }))
            return this.shut(line, [], [...failed, ...outside])
        }
    }

    /** The agents the old tag path must skip: the turns this router took and, while the path is shut, the turns that did not start. */
    private shut(
        line: PersonLineHeard,
        taken: ReadonlyArray<string>,
        unrouted: ReadonlyArray<UnroutedTurn>,
    ): Promise<ReadonlyArray<string>> {
        return this.fallback === undefined ? Promise.resolve(taken) : this.fallback.shut(line, taken, unrouted)
    }

    /**
     * "Save to Second Brain" on a message: the owner or a manager files it as a truth change. With the truth named on the form it is
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
        const named = request.fact ?? null
        if (named !== null && this.changes !== undefined) {
            const filed = await this.changes.propose(workspaceId, {
                subjectLabel: named.subjectLabel,
                attributeLabel: named.attributeLabel,
                value: named.value ?? null,
                unit: named.unit ?? null,
                room: roomKind,
                messageId: message.id,
                quote: message.body.slice(0, 500),
                validFrom: named.validFrom ?? null,
                validTo: named.validTo ?? null,
                reason: captureReasonOf(asker.name, named.value ?? null),
                proposedBy: agent.module,
                agentId: agent.id,
                // The agent's instance only finds a value kept for it (changed in its scope); a new truth is filed workspace-wide (FX6).
                installationId: (await this.scopes?.lensOf(workspaceId, agent.id))?.installationId ?? null,
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
        if (ended === "no_chat_turn" || ended === "no_agent") return this.captured("no_chat_turn")
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
    ): Promise<ReadonlyArray<AgentEnd>> {
        let context: Promise<TurnContext | null> | null = null
        const read = (): Promise<TurnContext | null> => {
            context ??= this.seatOf(line.workspaceId, line.userId).then((seat) =>
                seat === null
                    ? null
                    : this.contextOf(line.workspaceId, line.room.id, line.message.id, line.repliedTo, seat),
            )
            return context
        }
        const ends: Array<AgentEnd> = []
        await eachInOrder(agentIds, async (agentId) => {
            const agent = await this.agents.find(line.workspaceId, agentId)
            const ended: TurnEnd =
                agent === null
                    ? "no_agent"
                    : await this.turnOf(
                          line.workspaceId,
                          agent,
                          { id: line.message.id, body: line.message.body, roomId: line.room.id },
                          { room, intent: "answer", eventKey: turnKeyOf(line.message.id, agentId) },
                          read,
                      )
            ends.push({ agentId, ended })
            this.logger.info(ended === "started" ? TeamChatTurnsLogEvent.TurnStarted : TeamChatTurnsLogEvent.TurnSkipped, {
                agentId,
                roomId: line.room.id,
                code: ended,
            })
        })
        return ends
    }

    /** One agent's turn: when its module ships one, within the room's limit, as one workflow call of the person (the `team-chat` workflow, latest). */
    private async turnOf(
        workspaceId: string,
        agent: AgentCard,
        asked: AskedLine,
        how: TurnHow,
        read: () => Promise<TurnContext | null>,
    ): Promise<TurnEnd> {
        // A module ships a chat turn when a plugin ships its chat-turn template (`<module>.team-chat`).
        const templateId = `${agent.module}.${TEAM_CHAT_WORKFLOW_KEY}`
        if (INSTALLED.templateOf(templateId) === null) return "no_chat_turn"
        await this.held(workspaceId, agent, templateId)
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
        const event = WORKFLOW_CALL_TRIGGER.translate({ key: how.eventKey, params: { ...params } }, { connectionId: null })
        if (event === null) return "not_tagged"
        const result = await this.entityManager.transaction((tx) =>
            this.triggers.deliver(
                {
                    workspaceId,
                    declaration: WORKFLOW_CALL_TRIGGER,
                    connectionId: null,
                    agentId: agent.id,
                    events: [
                        {
                            event,
                            pin: { workflow: TEAM_CHAT_WORKFLOW_KEY, version: LATEST_VERSION },
                            actorMemberId: context.asker.memberId,
                        },
                    ],
                },
                tx,
            ),
        )
        const delivery = callDeliveryOf(result)
        if (delivery === "started") return "started"
        return delivery === "duplicate" ? "duplicate" : "not_tagged"
    }

    /**
     * The pin names the agent's OWN `team-chat` workflow, and only a seed makes a workflow from a template: an agent a person installed
     * through the app holds none, so its pinned wake would find no workflow and end with no handler. Before the pin is written the
     * agent is given the chat-turn workflow of its module when it holds none from that template (once: afterwards this is one read);
     * one it already holds is left as its owner set it. A failure is logged and the turn goes on, so the engine still tells the
     * founder when nothing takes the wake.
     */
    private async held(workspaceId: string, agent: AgentCard, templateId: string): Promise<void> {
        if (this.workflows === undefined) return
        try {
            const made = await this.workflows.seedAgent(workspaceId, agent.id, agent.module, templateId)
            if (made > 0) this.logger.info(TeamChatTurnsLogEvent.ChatTurnSeeded, { agentId: agent.id })
        } catch (cause) {
            this.logger.error(TeamChatTurnsLogEvent.ChatTurnSeedFailed, cause, { agentId: agent.id })
        }
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
