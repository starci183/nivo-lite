import { Injectable } from "@nestjs/common"
import { AgentGraphsError, AgentStepTitlesService, AgentWorkflowsService } from "@modules/domain/agent-graphs"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionsService } from "@modules/domain/connections"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { MemberLookupService } from "@modules/domain/workspace-members"
import type { Locale } from "@modules/platform/i18n"

/** An agent as the contacts page names it, with the installation that runs it (where its workbench lives). */
export interface NamedAgent {
    /** The agent id. */
    readonly agentId: string
    /** The agent's display name. */
    readonly name: string
    /** The key of the agent's module. */
    readonly moduleKey: string
    /** The installation the agent runs as, or null when it drives none. */
    readonly installationId: string | null
}

/** A connection (an account of a channel) as the contacts page names it. */
export interface NamedConnection {
    /** The name the owner gave the connection. */
    readonly name: string
    /** The provider it connects to. */
    readonly provider: string
}

/** The most distinct ids one read names at once: a page of lines or routes holds few agents, members and workflows. */
const NAMES_MAX = 100

const distinct = (ids: ReadonlyArray<string | null>): Array<string> =>
    [...new Set(ids.filter((id): id is string => id !== null))].slice(0, NAMES_MAX)

@Injectable()
/**
 * The names the contacts page puts on the ids the engine keeps: agents (with the installation that runs them), staff members, the
 * connections of the entrances, the workflows, and the steps by the title their installed node declares. Every lookup is bounded by the
 * ids asked and answers only what it finds: an id that no longer names anything is absent, and the page shows it with no name.
 */
export class ContactNamesService {
    constructor(
        private readonly agents: AgentDirectoryService,
        private readonly installations: InstallationRecordsService,
        private readonly members: MemberLookupService,
        private readonly connections: ConnectionsService,
        private readonly workflows: AgentWorkflowsService,
        private readonly titles: AgentStepTitlesService,
    ) {}

    /** The agents among the ids, each with the installation it runs as. */
    async agentsOf(workspaceId: string, ids: ReadonlyArray<string | null>): Promise<ReadonlyMap<string, NamedAgent>> {
        const wanted = distinct(ids)
        if (wanted.length === 0) return new Map()
        const cards = await this.agents.cardsOf(workspaceId, wanted)
        const named = await Promise.all(
            cards.map(async (card): Promise<NamedAgent> => {
                const installation = await this.installations.ofAgent(workspaceId, card.id)
                return { agentId: card.id, name: card.name, moduleKey: card.module, installationId: installation?.id ?? null }
            }),
        )
        return new Map(named.map((agent) => [agent.agentId, agent]))
    }

    /** The display names of the members (membership ids: the seat of a person in the workspace, active or gone). */
    async membersOf(ids: ReadonlyArray<string | null>): Promise<ReadonlyMap<string, string>> {
        const found = await Promise.all(distinct(ids).map((id) => this.members.byId(id)))
        return new Map(found.flatMap((member) => (member === null ? [] : [[member.id, member.displayName] as const])))
    }

    /** The connections among the ids (a site, an API key or a removed connection is none). */
    async connectionsOf(workspaceId: string, ids: ReadonlyArray<string | null>): Promise<ReadonlyMap<string, NamedConnection>> {
        const wanted = distinct(ids)
        if (wanted.length === 0) return new Map()
        const records = await this.connections.findMany(workspaceId, wanted)
        return new Map(records.map((record) => [record.id, { name: record.name, provider: record.provider }]))
    }

    /** The names of the workflows among the ids; a workflow that no longer exists is absent. */
    async workflowNamesOf(workspaceId: string, ids: ReadonlyArray<string | null>, locale: Locale): Promise<ReadonlyMap<string, string>> {
        const found = await Promise.all(
            distinct(ids).map(async (id) => {
                try {
                    return [id, (await this.workflows.detail(workspaceId, id, locale)).workflow.name] as const
                } catch (cause: unknown) {
                    if (cause instanceof AgentGraphsError) return null
                    throw cause
                }
            }),
        )
        return new Map(found.flatMap((entry) => (entry === null ? [] : [entry])))
    }

    /** The title of a step (the id of the SDK step a node runs) in the language, or null when no installed node declares it. */
    stepTitleOf(step: string | null, locale: Locale): string | null {
        if (step === null) return null
        return this.titles.titleOf(step)?.[locale] ?? null
    }
}
