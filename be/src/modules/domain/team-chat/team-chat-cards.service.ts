import { Injectable } from "@nestjs/common"
import { AgentDirectoryService, type OptionalId } from "@modules/domain/agents"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { AgentPostInput, ChatMemberRef, LineInput, ReportInput } from "./team-chat.contracts"
import { cardBodyOf, directKeyOf, isUuid } from "./team-chat.policy"
import { TeamChatAccessService } from "./team-chat-access.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import type { OptionalAgentLine, OptionalLine, OptionalReport } from "./team-chat-store.contracts"

@Injectable()
/**
 * What the engine's jobs write into the chat: the report of a finished run, the approval card of a decision and the lines of an agent.
 * A person can only ever write text; these cards and lines are the engine's, each written once per run, decision or key, and the
 * direct rooms they need are opened on the write, never on a read.
 */
export class TeamChatCardsService {
    constructor(
        private readonly store: TeamChatStoreService,
        private readonly access: TeamChatAccessService,
        private readonly agents: AgentDirectoryService,
        private readonly workspaces: WorkspacesService,
    ) {}

    /**
     * Writes the report of a finished run: ONE `report` message with the run as its ref, in the room the agent is configured to report
     * to, else in the direct room between the agent and the owner of the workspace, opened here when it does not exist (never on a read).
     * A retry of the job finds the card it wrote. Null when the workspace, the agent or the room is gone.
     */
    async postReport(workspaceId: string, report: ReportInput): Promise<OptionalReport> {
        const roomId = await this.reportRoom(workspaceId, report.agentId, report.roomId)
        if (roomId === null) return null
        const written = await this.store.insertCard({
            workspaceId,
            roomId,
            authorId: report.agentId,
            kind: "report",
            refId: report.runId,
            body: cardBodyOf(report.body),
        })
        return written === null ? null : { roomId, ...written }
    }

    /**
     * Writes one line of an agent (or of the system when no agent speaks) into a room: the replacement of the old Office lines. The room is
     * named, or the line goes to one person and the direct room between them and the agent is opened on demand. The same key from the same
     * agent in the same room is the same line. Null when the room, the person or the agent is not of the workspace.
     */
    async postMessage(workspaceId: string, line: LineInput): Promise<OptionalLine> {
        const roomId = await this.lineRoom(workspaceId, line)
        const text = line.body.trim()
        if (roomId === null || text.length === 0) return null
        const created = await this.store.insertLine({
            workspaceId,
            roomId,
            authorAgentId: line.authorAgentId,
            body: cardBodyOf(text),
            key: line.key,
            agentMessage: line.agentMessage ?? null,
            replyTo: line.replyTo ?? null,
        })
        if (created !== null) return { roomId, messageId: created }
        if (line.authorAgentId === null || line.key === null) return null
        const kept = await this.store.lineKept(roomId, line.authorAgentId, line.key)
        return kept === null ? null : { roomId, messageId: kept }
    }

    /**
     * Says one line as an agent to one person: the agent is named by its id or by the key of its module (the first agent of that module
     * in the workspace), the person defaults to the owner of the workspace. The direct room between them is opened on this write, never
     * on a read, and the same key from the same agent is the same line. Null when the agent or the person is not of the workspace.
     */
    async postAsAgent(workspaceId: string, post: AgentPostInput): Promise<OptionalAgentLine> {
        const agentId = await this.agentNamed(workspaceId, post.agent)
        const toUserId = post.toUserId ?? (await this.workspaces.ownerIdOf(workspaceId))
        if (agentId === null || toUserId === null) return null
        const posted = await this.postMessage(workspaceId, {
            authorAgentId: agentId,
            roomId: null,
            toUserId,
            body: post.body,
            key: post.key,
            agentMessage: post.agentMessage ?? null,
        })
        return posted === null ? null : { ...posted, agentId }
    }

    /** The agent a name stands for: an agent id of the workspace, or the key of a module whose first agent it is. */
    private async agentNamed(workspaceId: string, named: string): Promise<OptionalId> {
        if (isUuid(named)) {
            const [found] = await this.agents.activeInOrder(workspaceId, [named], 1)
            return found?.id ?? null
        }
        const [first] = await this.agents.idsOfModule(workspaceId, named, 1)
        return first ?? null
    }

    /** The room a line goes to: the named room of the workspace, or the direct room between the person and the agent. */
    private async lineRoom(workspaceId: string, line: LineInput): Promise<OptionalId> {
        if (line.roomId !== null) return (await this.store.roomById(workspaceId, line.roomId))?.id ?? null
        if (line.toUserId === null || line.authorAgentId === null) return null
        return this.directRoomOf(workspaceId, line.toUserId, { memberKind: "agent", memberId: line.authorAgentId })
    }

    /** The room a run reports to: the configured one when it is of the workspace, else the agent's direct room with the owner. */
    private async reportRoom(workspaceId: string, agentId: string, preferred: OptionalId): Promise<OptionalId> {
        const configured = preferred === null ? null : await this.store.roomById(workspaceId, preferred)
        if (configured !== null) return configured.id
        const ownerId = await this.workspaces.ownerIdOf(workspaceId)
        return ownerId === null
            ? null
            : this.directRoomOf(workspaceId, ownerId, { memberKind: "agent", memberId: agentId })
    }

    /** The direct room of a person and a member, opened when the pair has none; null when the member is not of the workspace. */
    private async directRoomOf(workspaceId: string, userId: string, other: ChatMemberRef): Promise<OptionalId> {
        const me: ChatMemberRef = { memberKind: "user", memberId: userId }
        if (!(await this.access.allKnown(workspaceId, [me, other]))) return null
        const directKey = directKeyOf(me, other)
        const existing = await this.store.roomByDirectKey(workspaceId, directKey)
        if (existing !== null) return existing.id
        const opened = await this.store.insertRoom({
            workspaceId,
            createdBy: userId,
            kind: "direct",
            name: null,
            directKey,
            others: [other],
        })
        return opened.id
    }
}
