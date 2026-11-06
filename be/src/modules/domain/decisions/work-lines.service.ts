import { Injectable } from "@nestjs/common"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectWorkAgentDirectory } from "./work-engine.decorators"
import type { OptionalAgentIdentity, WorkAgentDirectory, WorkLine, WorkLineScope } from "./work-lines.contracts"

@Injectable()
/**
 * Says what the work engine did ("needs approval", "done", "refused") to people in the team chat. A line is spoken by the agent of the
 * department when it has one and goes to the rooms the caller names, else to the owner's direct room with that agent; without a room and an
 * agent there is nobody to say it to and nothing is written. Words come from the caller; no card, no business in the chat.
 */
export class WorkLinesService {
    constructor(
        private readonly chat: TeamChatRoomsService,
        private readonly workspaces: WorkspacesService,
        @InjectWorkAgentDirectory() private readonly agents: WorkAgentDirectory,
    ) {}

    /** Writes the line to the rooms it names or to the owner; a line with nobody to say it to is not written. */
    async say(scope: WorkLineScope, line: WorkLine): Promise<void> {
        const agent = await this.speaker(scope, line)
        const rooms = line.roomIds ?? []
        if (rooms.length > 0) {
            await this.toRooms(scope, line, agent, rooms)
            return
        }
        const owner = await this.workspaces.ownerIdOf(scope.workspaceId)
        if (owner === null || agent === null) return
        await this.chat.postMessage(scope.workspaceId, {
            authorAgentId: agent.id,
            roomId: null,
            toUserId: owner,
            body: line.body,
            key: line.key ?? null,
        })
    }

    private async toRooms(
        scope: WorkLineScope,
        line: WorkLine,
        agent: OptionalAgentIdentity,
        rooms: ReadonlyArray<string>,
    ): Promise<void> {
        await Promise.all(
            rooms.map((roomId) =>
                this.chat.postMessage(scope.workspaceId, {
                    authorAgentId: agent === null ? null : agent.id,
                    roomId,
                    toUserId: null,
                    body: line.body,
                    key: agent === null ? null : (line.key ?? null),
                }),
            ),
        )
    }

    private speaker(scope: WorkLineScope, line: WorkLine): Promise<OptionalAgentIdentity> {
        if (line.agentId !== undefined && line.agentId !== null) return Promise.resolve({ id: line.agentId, name: "" })
        if (line.department === undefined) return Promise.resolve(null)
        return this.agents.agentOfDepartment(scope.workspaceId, line.department, line.installationId ?? null)
    }
}
