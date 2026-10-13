import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { BoundConnection } from "@modules/domain/agent-connections"
import { WorkspaceMembersService, isManagerRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type {
    AgentDashboardData,
    AgentSummary,
    AgentTexts,
    DashboardQuery,
    DoneData,
    KnowledgeData,
    NewAgent,
    OptionalAgentProfile,
    OptionalAgentRef,
    OptionalId,
    Region,
    WaitingData,
} from "./agents.contracts"
import { InjectInstallations, InjectKnowledge } from "./agents.decorators"
import { AgentsLogEvent } from "./agents.log-events"
import { firstProfileOf, refOf, summaryOf } from "./agents.mapper"
import type { InstallationDirectory, KnowledgeLens, OptionalInstallation } from "./agents.port"
import {
    GAP_LIMIT,
    LIST_LIMIT,
    TEST_RUN_PATTERN,
    agentIdOf,
    agentOf,
    connectionItemsOf,
    itemOf,
    knowledgeOf,
    totalOf,
} from "./dashboard.mapper"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import type { AgentRow, IdRow } from "./persistence/agents.rows"
import {
    FIND_ACTIVE_AGENT,
    FIND_AGENT,
    FIND_FIRST_ACTIVE_AGENT,
    INSERT_AGENT,
    LIST_AGENTS,
    RENAME_AGENT,
    SET_AGENT_STATUS,
    SET_AGENT_TEXTS,
} from "./persistence/agents.sql"
import type { DashboardItemRow } from "./persistence/dashboard.rows"
import { LIST_DONE_ITEMS, LIST_WAITING_ITEMS } from "./persistence/dashboard.sql"

const DAY_MS = 86_400_000
const DONE_WINDOW_DAYS = 7
const DASHBOARD_PURPOSES = ["inbound_chat", "outbound_chat", "bank_feed", "data_source", "tool"] as const
const UNIQUE_VIOLATION = "23505"
const GOVERNORS = ["owner", "manager"] as const

const isUniqueViolation = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === UNIQUE_VIOLATION

@Injectable()
/** The agents of a workspace as the Agents pages use them: the instance list, the dashboard regions, and the owner's edits of one agent. */
export class AgentsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectKnowledge() private readonly knowledge: KnowledgeLens,
        private readonly members: WorkspaceMembersService,
        private readonly bindings: AgentBindingsService,
    ) {}

    /** The agents of the workspace, oldest first, optionally of one module. */
    async list(userId: string, workspaceId: string, module: OptionalId = null): Promise<ReadonlyArray<AgentSummary>> {
        await this.members.require(userId, workspaceId)
        const rows = await this.entityManager.query<Array<AgentRow>>(LIST_AGENTS, [workspaceId, module])
        return rows.map(summaryOf)
    }

    /**
     * The agent that speaks for a department: the item's own instance's active agent when `installationId` names one, else the
     * department's first active agent. Called by the decisions engine, which has already proven the workspace.
     */
    async agentOfDepartment(
        workspaceId: string,
        department: string,
        installationId: OptionalId,
    ): Promise<OptionalAgentRef> {
        const installation = installationId === null ? null : await this.installations.byId(workspaceId, installationId)
        const instanceAgent = agentIdOf(installation)
        const [row] =
            instanceAgent === null
                ? await this.entityManager.query<Array<AgentRow>>(FIND_FIRST_ACTIVE_AGENT, [workspaceId, department])
                : await this.entityManager.query<Array<AgentRow>>(FIND_ACTIVE_AGENT, [instanceAgent, workspaceId])
        return row === undefined ? null : refOf(row)
    }

    /** The profile of one agent of the workspace, whatever its status; null when there is none. */
    async profileOf(workspaceId: string, agentId: string): Promise<OptionalAgentProfile> {
        return firstProfileOf(await this.entityManager.query<Array<AgentRow>>(FIND_AGENT, [agentId, workspaceId]))
    }

    /** The profile of the active agent that speaks for a department; null when it has none. */
    async profileOfDepartment(workspaceId: string, department: string): Promise<OptionalAgentProfile> {
        return firstProfileOf(
            await this.entityManager.query<Array<AgentRow>>(FIND_FIRST_ACTIVE_AGENT, [workspaceId, department]),
        )
    }

    /** The common regions of one module's agent dashboard. Every region is read on its own and fails on its own. */
    async dashboard(userId: string, query: DashboardQuery): Promise<AgentDashboardData> {
        const viewer = await this.members.require(userId, query.workspaceId)
        const installation = await this.installationOf(query)
        // A multi-instance type shows only its own instance's work; a single-instance type keeps reading the whole department.
        const scopeId = installation?.isMulti === true ? installation.id : null
        const [waiting, done, connections, knowledge] = await Promise.all([
            this.settle("waiting", () => this.waiting(query, scopeId)),
            this.settle("done", () => this.done(query, scopeId)),
            this.settle("connections", async () =>
                connectionItemsOf(await this.connectionsOf(agentIdOf(installation))),
            ),
            this.settle("knowledge", () => this.knowledgeOf(query, installation, isManagerRole(viewer.role))),
        ])
        return {
            agent: agentOf(installation),
            waiting,
            done,
            connections,
            knowledge,
        }
    }

    /** Adds an agent to the workspace; a manager only. The handle must be free. */
    async create(userId: string, agent: NewAgent): Promise<AgentSummary> {
        await this.members.require(userId, agent.workspaceId, GOVERNORS)
        const [row] = await this.entityManager
            .query<Array<AgentRow>>(INSERT_AGENT, [
                agent.workspaceId,
                agent.module,
                agent.name,
                agent.handle,
                agent.role,
                agent.instructions,
            ])
            .catch((cause: unknown) => {
                if (!isUniqueViolation(cause)) throw cause
                throw new AgentsError({ code: AgentsErrorCode.HandleTaken, params: { handle: agent.handle }, cause })
            })
        if (row === undefined) throw new AgentsError({ code: AgentsErrorCode.NotCreated })
        return summaryOf(row)
    }

    /** Renames an agent; a manager only. */
    async rename(userId: string, workspaceId: string, agentId: string, name: string): Promise<void> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        this.expectChanged(
            await this.entityManager.query<Array<IdRow>>(RENAME_AGENT, [agentId, workspaceId, name]),
            agentId,
        )
    }

    /** Pauses or resumes an agent; a manager only. */
    async setStatus(userId: string, workspaceId: string, agentId: string, active: boolean): Promise<void> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        this.expectChanged(
            await this.entityManager.query<Array<IdRow>>(SET_AGENT_STATUS, [
                agentId,
                workspaceId,
                active ? "active" : "paused",
            ]),
            agentId,
        )
    }

    /** Replaces the free texts of an agent (the setup chat applies a context version this way); a manager only. */
    async setTexts(userId: string, workspaceId: string, agentId: string, texts: AgentTexts): Promise<void> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        this.expectChanged(
            await this.entityManager.query<Array<IdRow>>(SET_AGENT_TEXTS, [
                agentId,
                workspaceId,
                texts.instructions,
                texts.knowledge,
            ]),
            agentId,
        )
    }

    private expectChanged(rows: ReadonlyArray<IdRow>, agentId: string): void {
        if (rows.length === 0) throw new AgentsError({ code: AgentsErrorCode.AgentNotFound, params: { id: agentId } })
    }

    private installationOf(query: DashboardQuery): Promise<OptionalInstallation> {
        return query.installationId === undefined || query.installationId === null
            ? this.installations.firstOfModule(query.workspaceId, query.module)
            : this.installations.byId(query.workspaceId, query.installationId)
    }

    private async settle<T>(region: string, read: () => Promise<T>): Promise<Region<T>> {
        try {
            return { ok: true, data: await read() }
        } catch (cause) {
            this.logger.error(AgentsLogEvent.DashboardRegionFailed, cause, { region })
            return { ok: false }
        }
    }

    private async waiting(query: DashboardQuery, scopeId: string | null): Promise<WaitingData> {
        const rows = await this.entityManager.query<Array<DashboardItemRow>>(LIST_WAITING_ITEMS, [
            query.workspaceId,
            query.module,
            scopeId,
            TEST_RUN_PATTERN,
            LIST_LIMIT,
        ])
        return { total: totalOf(rows), items: rows.map(itemOf) }
    }

    private async done(query: DashboardQuery, scopeId: string | null): Promise<DoneData> {
        const since = new Date(this.clock.now().getTime() - DONE_WINDOW_DAYS * DAY_MS).toISOString()
        const rows = await this.entityManager.query<Array<DashboardItemRow>>(LIST_DONE_ITEMS, [
            query.workspaceId,
            query.module,
            scopeId,
            TEST_RUN_PATTERN,
            since,
            LIST_LIMIT,
        ])
        return { count: totalOf(rows), items: rows.map(itemOf) }
    }

    private connectionsOf(agentId: OptionalId): Promise<ReadonlyArray<BoundConnection>> {
        return agentId === null ? Promise.resolve([]) : this.bindings.connectionsFor(agentId, DASHBOARD_PURPOSES)
    }

    private async knowledgeOf(
        query: DashboardQuery,
        installation: OptionalInstallation,
        manager: boolean,
    ): Promise<KnowledgeData> {
        const installationId = installation?.id ?? null
        const counts = await this.knowledge.countsFor(query.workspaceId, query.module, installationId)
        // The gaps are manager-only and may not be kept at all: either way the region simply has no gaps block.
        const gaps = manager ? await this.knowledge.openGapsOf(query.workspaceId, query.module, GAP_LIMIT) : null
        return knowledgeOf(counts, gaps)
    }
}
