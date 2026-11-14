import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionActor } from "@modules/domain/connections"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { ToolGrantsService } from "@modules/domain/tool-grants"
import { callLogViewOf, grantViewOf } from "./tool-rows.mapper"
import { ToolsError, ToolsErrorCode } from "./errors/tools.error"
import { AgentAccountsService } from "./agent-accounts.service"
import type {
    AttachmentChangeResult,
    AttachmentRefusal,
    AttachmentWish,
    ProviderBoard,
    TemplateCandidate,
    TemplateProposal,
} from "./agent-accounts.contracts"
import type { CallLogQuery, CallLogView, GrantView } from "./tools.contracts"

const LOG_MAX = 200
const LOG_DEFAULT = 50
const MANAGER = ["owner", "manager"] as const

/** The refusal of a change of an attachment, with its reason. */
const attachmentRefused = (reason: AttachmentRefusal): ToolsError =>
    new ToolsError({ code: ToolsErrorCode.AttachmentRefused, params: { reason } })

/** Passes a change that was made; throws the refusal of one that was not. */
const attachmentDone = (result: AttachmentChangeResult): void => {
    if (!result.ok) throw attachmentRefused(result.reason)
}

@Injectable()
/**
 * The console side of the tools: the accounts board (attachments of agents to accounts: the kill switch), the grant rows of a road
 * outside every node, and the audit log of the calls. Every operation needs the owner or manager role, the roles that manage connections.
 */
export class ToolsConsoleService {
    constructor(
        private readonly grantRows: ToolGrantsService,
        private readonly callLines: ToolCallLogService,
        private readonly connections: ConnectionsService,
        private readonly accounts: AgentAccountsService,
    ) {}

    /** The accounts board: every provider with the tools it serves and its accounts, and every attachment of the workspace. */
    async providerBoard(actor: ConnectionActor): Promise<ProviderBoard> {
        await this.connections.authorize(actor, MANAGER)
        return this.accounts.board(actor.workspaceId)
    }

    /**
     * Every provider a module's template lists for a fresh agent, each saying whether the workspace connected it (only the working
     * accounts are attached at creation); nothing is written.
     */
    async attachmentProposal(actor: ConnectionActor, moduleKey: string): Promise<ReadonlyArray<TemplateProposal>> {
        await this.connections.authorize(actor, MANAGER)
        return this.accounts.templateProposal(actor.workspaceId, moduleKey)
    }

    /** Attaches an agent to a connected account; refused with its reason when it cannot be. */
    async attachProvider(actor: ConnectionActor, agentId: string, wish: AttachmentWish): Promise<void> {
        await this.connections.authorize(actor, MANAGER)
        attachmentDone(await this.accounts.attach({ workspaceId: actor.workspaceId, agentId }, wish, actor.principalId))
    }

    /** Detaches an agent from an account: the kill switch (every tool of that account becomes unavailable to the agent). */
    async detachProvider(actor: ConnectionActor, agentId: string, connectionId: string): Promise<void> {
        await this.connections.authorize(actor, MANAGER)
        attachmentDone(await this.accounts.detach(actor.workspaceId, agentId, connectionId))
    }

    /** The agents a template would attach to an account connected after they were created. */
    async templateCandidates(actor: ConnectionActor, connectionId: string): Promise<ReadonlyArray<TemplateCandidate>> {
        await this.connections.authorize(actor, MANAGER)
        return this.accounts.templateCandidates(actor.workspaceId, connectionId)
    }

    /** Attaches the listed agents to a provider by their template; answers the agents attached. */
    async attachByTemplate(
        actor: ConnectionActor,
        connectionId: string,
        agentIds: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<string>> {
        await this.connections.authorize(actor, MANAGER)
        const made = await this.accounts.attachByTemplate(actor.workspaceId, connectionId, agentIds, actor.principalId)
        if ("ok" in made) throw attachmentRefused(made.reason)
        return made
    }

    /** Every grant of the workspace. */
    async grants(actor: ConnectionActor): Promise<ReadonlyArray<GrantView>> {
        await this.connections.authorize(actor, MANAGER)
        return (await this.grantRows.listOfWorkspace(actor.workspaceId)).flatMap((row) => {
            const view = grantViewOf(row)
            return view === null ? [] : [view]
        })
    }

    /** The newest audit lines, at most two hundred; no limit means fifty. */
    async callLog(query: CallLogQuery): Promise<ReadonlyArray<CallLogView>> {
        await this.connections.authorize(query.actor, MANAGER)
        const limit = Math.min(LOG_MAX, Math.max(1, Math.round(query.limit ?? LOG_DEFAULT)))
        return (await this.callLines.latest({ workspaceId: query.actor.workspaceId, limit })).map((record) => callLogViewOf(record))
    }
}
