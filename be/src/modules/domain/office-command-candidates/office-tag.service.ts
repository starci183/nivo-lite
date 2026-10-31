import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentWakeService, AgentWorkSettingsService } from "@modules/domain/agent-work"
import type { AgentWakeContext } from "@modules/domain/agent-work"
import { AgentDirectoryService, AgentOwnershipService } from "@modules/domain/agents"
import type { AgentHandleCard } from "@modules/domain/agents"
import { OfficeLinesService, TeamChatService } from "@modules/domain/messages"
import type { PostedMessage } from "@modules/domain/messages"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import type { OfficeTagRequest, TagLineKey } from "./office-command-candidates.contracts"
import { mentionedHandles } from "./office-command.policy"
import { taggedAgentsOf } from "./office-tag.policy"

/** The most handles looked up for one line. */
const HANDLE_LIMIT = 10

/** A tagged agent and what its owner's switches and the author's right say about the tag. */
interface Verdict {
    /** The agent. */
    readonly agent: AgentHandleCard
    /** Whether the author may hand it work. */
    readonly allowed: boolean
    /** Whether work is switched off for the agent or its workspace. */
    readonly off: boolean
}

@Injectable()
/**
 * The Office line that may tag agents. The line, one note for each tag NIVO will not pass on, and one wake for each agent the author
 * may ask are written in one transaction, so a line never exists without its wakes and a retried line wakes nobody twice. Only the
 * line of a person wakes: an agent's own line can never start a loop. A tag the author has no right to is one NIVO line and no wake.
 */
export class OfficeTagService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly chat: TeamChatService,
        private readonly lines: OfficeLinesService,
        private readonly members: WorkspaceMembersService,
        private readonly agents: AgentDirectoryService,
        private readonly ownership: AgentOwnershipService,
        private readonly wakes: AgentWakeService,
        private readonly settings: AgentWorkSettingsService,
    ) {}

    /** Posts the caller's line in the room, wakes each agent it tags that the caller may ask, and answers the stored line. */
    async post(principalId: string, workspaceId: string, request: OfficeTagRequest): Promise<PostedMessage> {
        const memberId = await this.members.idOf(principalId, workspaceId)
        const verdicts = await this.verdictsOf(workspaceId, memberId, request.body)
        return this.entityManager.transaction(async (tx) => {
            const posted = await this.chat.postHuman(principalId, workspaceId, request.body, request.room, tx)
            await eachInOrder(verdicts, async (verdict) => {
                const key = this.noteKeyOf(verdict)
                if (key !== null) await this.note(tx, workspaceId, request, verdict.agent, key)
                if (verdict.allowed) {
                    await this.wakes.wake(tx, {
                        workspaceId,
                        agentId: verdict.agent.id,
                        source: "tag",
                        eventKey: posted.id,
                        context: this.contextOf(posted.id, principalId, request),
                        actorMemberId: memberId,
                    })
                }
            })
            return posted
        })
    }

    private async verdictsOf(workspaceId: string, memberId: string, body: string): Promise<Array<Verdict>> {
        const handles = mentionedHandles(body)
        if (handles.length === 0) return []
        const found = await this.agents.activeByHandles(workspaceId, handles.slice(0, HANDLE_LIMIT), HANDLE_LIMIT)
        const tagged = taggedAgentsOf(handles, found)
        if (tagged.length === 0) return []
        const workspace = await this.settings.settingsOf(workspaceId)
        const verdicts: Array<Verdict> = []
        await eachInOrder(tagged, async (agent) => {
            const allowed = await this.ownership.canAssign(memberId, agent.id)
            const state = allowed ? await this.settings.stateOf(agent.id) : null
            verdicts.push({ agent, allowed, off: !workspace.workEnabled || state?.workEnabled === false })
        })
        return verdicts
    }

    /** The note NIVO writes beside a tag: a refusal when the author has no right, a notice when work is off; none otherwise. */
    private noteKeyOf(verdict: Verdict): TagLineKey | null {
        if (!verdict.allowed) return "office.tagRefused"
        return verdict.off ? "office.tagWorkOff" : null
    }

    private note(
        tx: EntityManager,
        workspaceId: string,
        request: OfficeTagRequest,
        agent: AgentHandleCard,
        key: TagLineKey,
    ): Promise<void> {
        return this.lines.post(
            { workspaceId },
            {
                body: this.catalog.get(key, { handle: agent.handle }, request.locale),
                lead_id: null,
                work_item_id: null,
                room: request.room,
            },
            tx,
        )
    }

    private contextOf(messageId: string, principalId: string, request: OfficeTagRequest): AgentWakeContext {
        return {
            messageId,
            authorUserId: principalId,
            locale: request.locale,
            ...(request.room === null ? {} : { room: request.room }),
        }
    }
}
