import { Injectable } from "@nestjs/common"
import { graphSpecSchema, type GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion, type TemplateAgent } from "@nivo-lite/agent-sdk/template"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { EnterpriseRoster, EnterpriseRosterSeat } from "@modules/domain/channel-provisioning"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { INSTALLED, customerChannelProviders } from "@modules/domain/installed-plugins"
import { AgentAccountsService } from "@modules/domain/tools"
import { eachInOrder } from "@modules/platform/primitives"
import { GraphSeedService, type GraphSeedEntry, type SeededModule } from "./graph-seed.service"
import { attachPlanOf, frontDoorsOf, rosterOf } from "./roster-seed.policy"
import { InjectWorkspaceSeedOptions } from "./workspace-seed.decorators"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"

/** The graph installing a module's template agent publishes as its primary workflow (read as the seed reads a graph file), or null. */
const primaryGraphOf = (moduleKey: string): GraphSpec | null => {
    const primaries = INSTALLED.templatesOf(moduleKey).filter((template) => template.primary)
    const [only] = primaries
    if (only === undefined || primaries.length > 1) return null
    const parsed = graphSpecSchema.safeParse(JSON.parse(JSON.stringify(latestTemplateVersion(only).graph)))
    return parsed.success ? parsed.data : null
}

@Injectable()
/**
 * THE ROSTER STEP of the enterprise seed (`EnterpriseRoster`, ruling R17), generic: it knows no plugin, no agent and no provider by name.
 * Into the enterprise workspace it installs every template agent the enterprise's private plugins declare (`rosterOf`): the agent and its
 * module, its PRIMARY workflow adopted (the module's primary template graph, published as the graph seed publishes a graph file) with the
 * module's other templates as drafts, its accounts attached BY KIND (`attachPlanOf`: live accounts first, sandbox ones on the local stack
 * where no live one exists; a kind with none is reported, never fatal), and each customer channel's connections bound inbound to the
 * channel's front door agent (`frontDoorsOf`) where no agent answers them yet. Foundation only; everything is an upsert or an insert of
 * what is missing, so a second run changes nothing.
 */
export class RosterSeedService implements EnterpriseRoster {
    constructor(
        @InjectWorkspaceSeedOptions() private readonly options: WorkspaceSeedOptions,
        private readonly graphs: GraphSeedService,
        private readonly connections: ConnectionsService,
        private readonly abilities: AgentAccountsService,
        private readonly bindings: AgentBindingsService,
    ) {}

    /** Installs the enterprise's roster into its workspace; true when anything was written. */
    async install(seat: EnterpriseRosterSeat): Promise<boolean> {
        const { identifier, workspaceId } = seat
        const roster = rosterOf(INSTALLED.plugins, INSTALLED.templateAgents(), identifier)
        if (roster.length === 0) {
            this.options.print(`${identifier}: no plugin declares a roster for this enterprise`)
            return false
        }
        const connections = await this.connections.list(workspaceId)
        const entries = await this.entriesOf(seat, roster, connections)
        const seeded = await this.graphs.seedInto(workspaceId, entries)
        const bound = await this.bindFrontDoors(seat, roster, seeded, connections)
        this.options.print(`${identifier}: roster of ${String(seeded.length)} agents, ${String(bound)} channels given a front door`)
        return seeded.some((module) => module.changed) || bound > 0
    }

    /** One graph entry per roster agent with a single primary workflow, each with its accounts by kind; the others are reported. */
    private async entriesOf(
        seat: EnterpriseRosterSeat,
        roster: ReadonlyArray<TemplateAgent>,
        connections: ReadonlyArray<ConnectionRecord>,
    ): Promise<ReadonlyArray<GraphSeedEntry>> {
        const sandbox = new Set(connections.filter((connection) => connection.sandbox).map((connection) => connection.id))
        const entries: Array<GraphSeedEntry> = []
        await eachInOrder(roster, async (agent) => {
            const spec = primaryGraphOf(agent.key)
            if (spec === null) {
                this.options.print(`${seat.identifier}: ${agent.key} has no single primary workflow installed: not seeded`)
                return
            }
            const plan = attachPlanOf(
                await this.abilities.templateProposal(seat.workspaceId, agent.key),
                (connectionId) => sandbox.has(connectionId),
                seat.place,
            )
            for (const kind of plan.missing) {
                this.options.print(`${seat.identifier}: ${agent.key} works with ${kind}: no usable account connected, attach one when it is`)
            }
            entries.push({ spec, wishes: plan.wishes })
        })
        return entries
    }

    /**
     * Binds each customer-channel connection of the workspace to its channel's front door agent where no agent answers it yet (an answering
     * agent is the owner's choice and is kept). A sandbox connection only on the local stack. Answers how many were bound.
     */
    private async bindFrontDoors(
        seat: EnterpriseRosterSeat,
        roster: ReadonlyArray<TemplateAgent>,
        seeded: ReadonlyArray<SeededModule>,
        connections: ReadonlyArray<ConnectionRecord>,
    ): Promise<number> {
        const doors = frontDoorsOf(roster, customerChannelProviders())
        const usable = connections.filter(
            (connection) =>
                doors.has(connection.provider) &&
                connection.status !== "disconnected" &&
                (!connection.sandbox || seat.place === "local"),
        )
        let bound = 0
        await eachInOrder(usable, async (connection) => {
            const door = doors.get(connection.provider)
            const agentId = seeded.find((module) => module.moduleKey === door)?.agentId
            if (agentId === undefined) return
            if ((await this.bindings.owningAgentOf(seat.workspaceId, connection.id)) !== null) return
            await this.bindings.grant(seat.ownerId, {
                workspaceId: seat.workspaceId,
                agentId,
                connectionId: connection.id,
                purpose: "inbound_chat",
            })
            this.options.print(`${seat.identifier}: ${connection.provider} connection ${connection.id} answered by ${String(door)}`)
            bound += 1
        })
        return bound
    }
}
