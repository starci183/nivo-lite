import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { PROFILE_RECEIPT_PREFIX } from "./messages/workspace-seed.messages"
import { ENSURE_OFFICE_ROOMS, MOVE_AGENT_HOME, ROOMS_FUNCTION_PRESENT } from "./persistence/workspace-profile.sql"
import { WORKSPACE_PROFILES } from "./profiles/workspace-profiles.templates"
import type {
    ProfileAgent,
    ProfileCommand,
    ProfileConnectorState,
    ProfileDocumentCounts,
    ProfileInstallation,
    ProfileReport,
    ProfileTarget,
    WorkspaceProfile,
} from "./workspace-profile.contracts"
import {
    InjectSeedAgents,
    InjectSeedConnectors,
    InjectSeedSources,
    InjectSeedToolGrants,
    InjectWorkspaceSeedOptions,
} from "./workspace-seed.decorators"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"
import { readEnsureFor, readProfileInput } from "./workspace-seed.policy"
import type {
    SeedAgentRecords,
    SeedConnectorInput,
    SeedConnectors,
    SeedSources,
    SeedToolGrant,
    SeedToolGrants,
} from "./workspace-seed.port"
import { ProfileActivationService } from "./profile-activation.service"
import { WorkspaceSeedService } from "./workspace-seed.service"

/** Whether the rooms function exists. */
interface PresentRow {
    /** True when installed. */
    readonly present: boolean
}

/** What the agents step kept: the home room of each agent, the tool grants to write and the installations to activate. */
interface KeptAgents {
    /** Agent id and the key of its home room. */
    readonly homes: ReadonlyArray<readonly [string, string]>
    /** The grants of every agent. */
    readonly grants: ReadonlyArray<SeedToolGrant>
    /** The installation of every agent. */
    readonly installations: ReadonlyArray<ProfileInstallation>
}

/** The origin stamped on every document of a profile, so a re-run finds its own documents and nothing else. */
const originOf = (profile: WorkspaceProfile): string => `seed:${profile.key}`

const invalid = (): never => {
    throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
}

/** The grants of one agent as the tool grants owner stores them; argument bounds pass through as profile data. */
const grantsOf = (workspaceId: string, agentId: string, agent: ProfileAgent): ReadonlyArray<SeedToolGrant> =>
    agent.tools.map((grant) => ({
        workspaceId,
        agentId,
        tool: grant.tool,
        mode: grant.mode,
        limitVnd: grant.limitVnd,
        constraints: grant.constraints,
    }))

@Injectable()
/**
 * Applies a named workspace profile on top of the explicit workspace seed: the brand, the agents and their installations (applied
 * through the setup chat and settled), the authority grants, the gateway tool grants, the workspace documents (queued into the
 * normal knowledge ingestion, which reads chunks and facts) and the Hub department rooms. Every table is written by its owner;
 * every step is idempotent. A dry run validates the private input and prints the plan without writing.
 */
export class WorkspaceProfileService {
    constructor(
        @InjectWorkspaceSeedOptions() private readonly options: WorkspaceSeedOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectSeedAgents() private readonly agents: SeedAgentRecords,
        @InjectSeedSources() private readonly sources: SeedSources,
        @InjectSeedToolGrants() private readonly toolGrants: SeedToolGrants,
        @InjectSeedConnectors() private readonly connectors: SeedConnectors,
        private readonly seeds: WorkspaceSeedService,
        private readonly workspaces: WorkspacesService,
        private readonly rules: AuthorityRulesService,
        private readonly activation: ProfileActivationService,
    ) {}

    /** Runs `seed-workspace profile`: the private ensure input must name the profile's workspace and the given owner. */
    async profileOperator(command: ProfileCommand): Promise<ProfileReport> {
        const profile = WORKSPACE_PROFILES.get(command.profile ?? "") ?? invalid()
        const request = readEnsureFor(this.options.input, command.owner, profile.workspaceName)
        const connectors = this.connectorInputs(profile)
        if (command.execute !== true) {
            const planned = connectors.map((connector): [string, ProfileConnectorState] => [
                connector.key,
                { tools: 0, approved: false },
            ])
            return this.print({
                ...this.receipt(profile, null),
                connectors: Object.fromEntries(planned),
                documents: { inserted: profile.documents.length, requeued: 0, unchanged: 0 },
                installations: Object.fromEntries(profile.agents.map((agent) => [agent.handle, "planned"])),
                rooms: "planned",
            })
        }
        const seeded = await this.seeds.seedOwned(request)
        const target = { workspaceId: seeded.report.workspaceId, ownerId: seeded.ownerId }
        return this.print(await this.apply(target, profile, connectors))
    }

    /** Applies the profile to one workspace as its owner and answers what it wrote. */
    async apply(
        target: ProfileTarget,
        profile: WorkspaceProfile,
        connectors: ReadonlyArray<SeedConnectorInput>,
    ): Promise<ProfileReport> {
        const { workspaceId, ownerId } = target
        await this.workspaces.setBrand(ownerId, workspaceId, {
            displayName: profile.displayName,
            logoUrl: profile.logoUrl,
        })
        const kept = await this.keepAgents(workspaceId, profile)
        const registered = await this.registerConnectors(target, connectors)
        const toolGrants = await this.toolGrants.upsert(kept.grants)
        const documents = await this.keepDocuments(target, profile)
        const rooms = await this.ensureRooms(workspaceId, kept.homes)
        await eachInOrder(profile.rules, async (rule) => {
            await this.rules.save(workspaceId, rule)
        })
        const installations = await this.activation.activate(target, kept.installations)
        return {
            ...this.receipt(profile, workspaceId),
            connectors: registered,
            toolGrants,
            documents,
            installations,
            rooms,
        }
    }

    /** The connectors of the profile with the endpoint the private profile input gives each; a missing endpoint is refused. */
    private connectorInputs(profile: WorkspaceProfile): ReadonlyArray<SeedConnectorInput> {
        if (profile.connectors.length === 0) return []
        const { urls } = readProfileInput(this.options.profileInput)
        return profile.connectors.map((connector) => ({ ...connector, url: urls.get(connector.key) ?? invalid() }))
    }

    /**
     * Registers each connector as the owner: the gateway reads and pins its live catalog. An unreachable server fails the run; a
     * server whose credential no one entered yet is reported with no tools (the owner enters it in the console). The run never
     * approves a catalog: a person approves it in the console after reviewing the tool list, and until then the agents
     * get the gateway's unapproved answer.
     */
    private async registerConnectors(
        target: ProfileTarget,
        connectors: ReadonlyArray<SeedConnectorInput>,
    ): Promise<Readonly<Record<string, ProfileConnectorState>>> {
        if (connectors.length === 0) return {}
        const actor = { principalId: target.ownerId, workspaceId: target.workspaceId }
        await eachInOrder(connectors, async (connector) => {
            await this.connectors.registerRemote(actor, connector)
        })
        const views = await this.connectors.connectors(actor)
        const states = connectors.map((connector): [string, ProfileConnectorState] => {
            const view = views.find((candidate) => candidate.key === connector.key)
            if (view === undefined || (view.status !== "active" && view.credentialState !== "needed")) {
                throw new WorkspaceSeedError({
                    code: WorkspaceSeedErrorCode.ConnectorUnreachable,
                    params: { key: connector.key },
                })
            }
            const approved = view.approvedAt !== null && view.tools.every((tool) => tool.approved)
            return [connector.key, { tools: view.tools.length, approved }]
        })
        return Object.fromEntries(states)
    }

    /** Keeps every agent by its handle and installs its module unless an installation already drives it. */
    private async keepAgents(workspaceId: string, profile: WorkspaceProfile): Promise<KeptAgents> {
        const homes: Array<readonly [string, string]> = []
        const grants: Array<SeedToolGrant> = []
        const installations: Array<ProfileInstallation> = []
        await eachInOrder(profile.agents, async (agent) => {
            const agentId = await this.agents.ensureByHandle({
                workspaceId,
                module: agent.module,
                name: agent.name,
                handle: agent.handle,
                role: agent.role,
                instructions: agent.instructions,
            })
            const installation = await this.activation.install(workspaceId, agentId, agent)
            installations.push({ handle: agent.handle, installation, answers: agent.setup })
            if (agent.room !== null) homes.push([agentId, agent.room])
            grants.push(...grantsOf(workspaceId, agentId, agent))
        })
        return { homes, grants, installations }
    }

    /** Adds new documents, re-queues the ones whose text changed and counts the unchanged ones. */
    private async keepDocuments(target: ProfileTarget, profile: WorkspaceProfile): Promise<ProfileDocumentCounts> {
        const counts = { inserted: 0, requeued: 0, unchanged: 0 }
        await eachInOrder(profile.documents, async (document) => {
            const outcome = await this.sources.keep({ ...target, ...document, origin: originOf(profile) })
            counts[outcome] += 1
        })
        return counts
    }

    /** Creates the department rooms when the Hub rooms function is installed and seats each agent in its home room. */
    private async ensureRooms(
        workspaceId: string,
        homes: ReadonlyArray<readonly [string, string]>,
    ): Promise<ProfileReport["rooms"]> {
        const [check] = await this.entityManager.query<Array<PresentRow>>(ROOMS_FUNCTION_PRESENT)
        if (check?.present !== true) return "absent"
        await this.entityManager.query(ENSURE_OFFICE_ROOMS, [workspaceId])
        await eachInOrder(homes, async ([agentId, room]) => {
            await this.entityManager.query(MOVE_AGENT_HOME, [workspaceId, room, agentId])
        })
        return "ready"
    }

    /** The receipt fields every run shares. */
    private receipt(
        profile: WorkspaceProfile,
        workspaceId: string | null,
    ): Omit<ProfileReport, "connectors" | "documents" | "installations" | "rooms"> {
        return {
            schema: "nivo/workspace-profile@1",
            profile: profile.key,
            executed: workspaceId !== null,
            workspaceId,
            agents: profile.agents.length,
            rules: profile.rules.length,
            toolGrants: profile.agents.reduce((count, agent) => count + agent.tools.length, 0),
        }
    }

    private print(receipt: ProfileReport): ProfileReport {
        this.options.print(`${PROFILE_RECEIPT_PREFIX}${JSON.stringify(receipt)}`)
        return receipt
    }
}
