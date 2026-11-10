import { Injectable } from "@nestjs/common"
import type { EffectFacts, TeamAudience } from "@nivo-lite/blocks-core"
import type { EntityManager } from "typeorm"
import { IsNull } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { OptionalId } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { TeamChatError, TeamChatErrorCode } from "./errors/team-chat.error"
import { ChatRoomEntity, ChatRoomMemberEntity } from "./persistence/entities"
import {
    chatDone,
    chatRefusal,
    isPurposeValid,
    isUniqueViolation,
    lineClientIdOf,
    purposeColumnsOf,
} from "./team-chat.policy"
import type { ChatRoomView, GroupPurpose, TeamChatResult } from "./team-chat.contracts"
import type {
    GroupRoute,
    PurposeAudience,
    PurposeRoomFound,
    SharedPurpose,
    TeamCardMessage,
    TeamCardPost,
    TeamCardPosted,
} from "./team-chat-audience.contracts"
import { TeamChatAccessService } from "./team-chat-access.service"
import { TeamChatCardsService } from "./team-chat-cards.service"
import type { OptionalRoom } from "./team-chat-store.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatViewsService } from "./team-chat-views.service"

/** Why the agent's team room did not get the line: the workspace has no room for that team. */
const NO_TEAM_ROOM = "no_team_room"

/** Why the common room did not get the line: the workspace has no common room. */
const NO_COMMON_ROOM = "no_common_room"

/** Why a group room did not get the line: the agent holds no right to post there (a seat alone is not the right). */
const NO_POST_RIGHT = "no_post_right"

/** The purposes a card posted to a group room is copied under. */
const GROUP_PURPOSES: ReadonlyArray<SharedPurpose> = ["module", "common"]

/** Whether a stored value is the content of a card: its kind, intent, heading and words, and a payload. */
const isTeamCard = (value: unknown): value is TeamCardMessage =>
    typeof value === "object" &&
    value !== null &&
    ["kind", "intent", "title", "summary"].every((member) => typeof Reflect.get(value, member) === "string") &&
    Reflect.has(value, "payload")

@Injectable()
/**
 * Rooms by purpose and the right to post in them. A room says what it is for (plain, the common room of the workspace, or one module's
 * team room); an agent addresses an audience, never a room id. Every line reaches the founder's direct room, which an agent may always
 * post to; `own` (the agent's team room) and `everyone` (the common room) also post the same line in that group, but only when the
 * agent holds the right to post there, which a manager of the room grants per agent (membership alone is not the right). A missing room
 * or right never refuses: the facts say what was skipped and why. An agent that is not of the workspace, or a line that went nowhere,
 * fails the call.
 */
export class TeamChatAudienceService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly store: TeamChatStoreService,
        private readonly access: TeamChatAccessService,
        private readonly views: TeamChatViewsService,
        private readonly cards: TeamChatCardsService,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** The group of the workspace that holds a purpose: the common room, or the room of one module; null when there is none. */
    roomByPurpose(workspaceId: string, purpose: SharedPurpose, module: OptionalId): Promise<OptionalRoom> {
        return this.entityManager.findOne(ChatRoomEntity, {
            where: { workspaceId, purpose, purposeModule: purpose === "module" ? (module ?? "") : IsNull() },
        })
    }

    /** Whether another room of the workspace already holds the purpose; a plain group is never held. */
    async isHeld(workspaceId: string, given: GroupPurpose): Promise<boolean> {
        if (given.purpose === "group") return false
        const module = given.purpose === "module" ? given.module : null
        return (await this.roomByPurpose(workspaceId, given.purpose, module)) !== null
    }

    /**
     * Gives a group its purpose from its settings. Only who may manage the group may; a direct room keeps `direct`; a purpose another room
     * holds is refused, never moved.
     */
    async setRoomPurpose(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        given: GroupPurpose,
    ): Promise<TeamChatResult<ChatRoomView>> {
        const room = await this.access.visibleRoom(workspaceId, viewerId, roomId)
        if (room === null) return chatRefusal(TeamChatErrorCode.NotFound)
        const managed = room.kind === "group" && (await this.access.mayManage(workspaceId, viewerId, room))
        if (!managed) return chatRefusal(TeamChatErrorCode.Forbidden)
        if (!isPurposeValid(given)) return chatRefusal(TeamChatErrorCode.PurposeInvalid)
        try {
            await this.entityManager.update(ChatRoomEntity, { id: roomId }, purposeColumnsOf("group", given))
        } catch (cause) {
            if (isUniqueViolation(cause)) return chatRefusal(TeamChatErrorCode.PurposeTaken)
            throw cause
        }
        return chatDone(
            await this.views.roomView(workspaceId, viewerId, await this.store.roomOrFail(workspaceId, roomId)),
        )
    }

    /** The room of an audience for one agent, and whether it sits in it; or why there is none. */
    async audienceRoom(workspaceId: string, agentId: string, audience: PurposeAudience): Promise<PurposeRoomFound> {
        const agent = await this.agents.find(workspaceId, agentId)
        if (agent === null) return { found: false, reason: "agent_unknown", module: null }
        const purpose: SharedPurpose = audience === "own" ? "module" : "common"
        const module = purpose === "module" ? agent.module : null
        const room = await this.roomByPurpose(workspaceId, purpose, module)
        if (room === null) return { found: false, reason: "room_missing", module }
        const seat = await this.store.memberOf(room.id, { memberKind: "agent", memberId: agentId })
        return {
            found: true,
            room: { id: room.id, name: room.name ?? "", purpose, module, mayPost: seat?.mayPost === true },
        }
    }

    /**
     * Grants or revokes an agent's right to post in a group. Only who may manage the group may; the agent must already sit in it (a right
     * is held on the seat, never on a room the agent is not in).
     */
    async setPostRight(
        workspaceId: string,
        viewerId: string,
        roomId: string,
        agentId: string,
        mayPost: boolean,
    ): Promise<TeamChatResult<ChatRoomView>> {
        const room = await this.access.visibleRoom(workspaceId, viewerId, roomId)
        if (room === null) return chatRefusal(TeamChatErrorCode.NotFound)
        const managed = room.kind === "group" && (await this.access.mayManage(workspaceId, viewerId, room))
        if (!managed) return chatRefusal(TeamChatErrorCode.Forbidden)
        const agent = { memberKind: "agent" as const, memberId: agentId }
        if ((await this.store.memberOf(roomId, agent)) === null)
            return chatRefusal(TeamChatErrorCode.PostRightNeedsSeat)
        await this.entityManager.update(ChatRoomMemberEntity, { roomId, ...agent }, { mayPost })
        return chatDone(await this.views.roomView(workspaceId, viewerId, room))
    }

    /**
     * Posts one line or card of an agent: always in the founder's direct room, and also in the group room of the audience (`own`,
     * `everyone`) when the agent holds the right to post there, each once per key. The facts list every room posted to and say what was
     * skipped and why. The server-side way to post a card the server built (a report, an order card); the team-post tool goes through it.
     */
    async postTeamCard(workspaceId: string, post: TeamCardPost): Promise<TeamCardPosted> {
        const group = await this.groupRoute(workspaceId, post.agentId, post.audience)
        const line = { body: post.message.summary, agentMessage: JSON.stringify(post.message) }
        const direct = await this.cards.postAsAgent(workspaceId, {
            agent: post.agentId,
            toUserId: null,
            key: post.key,
            ...line,
        })
        if (direct === null) throw new TeamChatError({ code: TeamChatErrorCode.AgentMessageNotPosted })
        const rooms: Array<EffectFacts> = [{ purpose: "direct", roomId: direct.roomId, roomName: null }]
        if (group.room !== null) {
            const posted = await this.cards.postMessage(workspaceId, {
                authorAgentId: post.agentId,
                roomId: group.room.id,
                toUserId: null,
                key: lineClientIdOf(`${post.key}#${group.room.purpose}`),
                ...line,
            })
            if (posted === null) throw new TeamChatError({ code: TeamChatErrorCode.AgentMessageNotPosted })
            rooms.push({ purpose: group.room.purpose, roomId: posted.roomId, roomName: group.room.name })
        }
        return {
            messageId: direct.messageId,
            facts: { requested: post.audience, rooms, skipped: group.skipped, module: group.room?.module ?? null },
        }
    }

    /**
     * The structured content of the line an agent wrote under a key (the founder's direct copy), or null when there is none or it does
     * not read: the card a repeating report folds into.
     */
    async storedCard(workspaceId: string, key: string): Promise<TeamCardMessage | null> {
        const line = await this.store.agentLine(workspaceId, key)
        const raw = line?.ref?.agent_message
        if (raw === undefined) return null
        try {
            const parsed: unknown = JSON.parse(raw)
            return isTeamCard(parsed) ? parsed : null
        } catch {
            return null
        }
    }

    /**
     * Rewrites the card an agent already posted under a key in every room it went to (the direct room and, when it was posted there, the
     * team and common rooms), keeping each line and its client id: a person's reply to the folded card still names the same key. Answers
     * the id of the founder's line, or null when there is no such line.
     */
    async foldTeamCard(workspaceId: string, key: string, message: TeamCardMessage): Promise<string | null> {
        const line = await this.store.agentLine(workspaceId, key)
        if (line === null) return null
        const copies = [key, ...GROUP_PURPOSES.map((purpose) => lineClientIdOf(`${key}#${purpose}`))]
        await this.store.updateAgentLines(workspaceId, copies, {
            body: message.summary,
            agentMessage: JSON.stringify(message),
        })
        return line.id
    }

    /** The group room an audience adds beside the founder's direct room, or why it adds none. */
    private async groupRoute(workspaceId: string, agentId: string, requested: TeamAudience): Promise<GroupRoute> {
        if (requested === "founder") return { room: null, skipped: null }
        const found = await this.audienceRoom(workspaceId, agentId, requested)
        if (!found.found && found.reason === "agent_unknown")
            throw new TeamChatError({ code: TeamChatErrorCode.AgentMessageNotPosted })
        if (!found.found) return { room: null, skipped: requested === "own" ? NO_TEAM_ROOM : NO_COMMON_ROOM }
        return found.room.mayPost ? { room: found.room, skipped: null } : { room: null, skipped: NO_POST_RIGHT }
    }
}
