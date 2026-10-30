import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager, UpdateResult } from "typeorm"
import { WorkspaceMembersService, isManagerRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type {
    AgentDashboardData,
    AgentOwners,
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
import { AgentOwnershipService } from "./agent-ownership.service"
import { InjectAgentConnections, InjectInstallations, InjectKnowledge, InjectWorkDashboard } from "./agents.decorators"
import { AgentsLogEvent } from "./agents.log-events"
import { firstProfileOf, refOf, summaryOf } from "./agents.mapper"
import type { AgentRecord } from "./agents.mapper"
import type {
    AgentConnectionsDirectory,
    BoundConnectionView,
    InstallationDirectory,
    KnowledgeLens,
    OptionalInstallation,
    WorkDashboardDirectory,
} from "./agents.port"
import {
    GAP_LIMIT,
    LIST_LIMIT,
    TEST_RUN_PATTERN,
    agentIdOf,
    agentOf,
    connectionItemsOf,
    decisionHrefOf,
    itemOf,
    knowledgeOf,
    totalOf,
} from "./dashboard.mapper"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

const DAY_MS = 86_400_000
const DONE_WINDOW_DAYS = 7
const DASHBOARD_PURPOSES = ["inbound_chat", "outbound_chat", "bank_feed", "data_source", "tool"] as const
const UNIQUE_VIOLATION = "23505"
const GOVERNORS = ["owner", "manager"] as const

/** The most agents a workspace lists. */
const AGENT_LIMIT = 200

/** The agents newest columns the lists and finders order by: oldest first, the id as tie-break. */
/** Whether a RETURNING row carries the id of a stored agent, the shape of the returned columns. */
const isAgentRecord = (value: unknown): value is AgentRecord =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

const OLDEST_FIRST = { createdAt: "ASC", id: "ASC" } as const

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
        private readonly members: WorkspaceMembersService,
        @InjectAgentConnections() private readonly bindings: AgentConnectionsDirectory,
        private readonly ownership: AgentOwnershipService,
        @InjectWorkDashboard() private readonly work: WorkDashboardDirectory,
        @Optional() @InjectKnowledge() private readonly knowledge: KnowledgeLens | null = null,
    ) {}

    /** The agents of the workspace, oldest first, optionally of one module. */
    async list(userId: string, workspaceId: string, module: OptionalId = null): Promise<ReadonlyArray<AgentSummary>> {
        await this.members.require(userId, workspaceId)
        const rows = await this.entityManager.find(AgentEntity, {
            where: module === null ? { workspaceId } : { workspaceId, module },
            order: OLDEST_FIRST,
            take: AGENT_LIMIT,
        })
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
        const row =
            instanceAgent === null
                ? await this.entityManager.findOne(AgentEntity, {
                      where: { workspaceId, module: department, status: "active" },
                      order: OLDEST_FIRST,
                  })
                : await this.entityManager.findOne(AgentEntity, {
                      where: { id: instanceAgent, workspaceId, status: "active" },
                  })
        return row === null ? null : refOf(row)
    }

    /** The agent of the workspace with this id, active or paused; null when there is none. */
    async agentById(workspaceId: string, agentId: string): Promise<OptionalAgentRef> {
        const row = await this.entityManager.findOne(AgentEntity, { where: { id: agentId, workspaceId } })
        return row === null ? null : refOf(row)
    }

    /** The profile of one agent of the workspace, whatever its status; null when there is none. */
    async profileOf(workspaceId: string, agentId: string): Promise<OptionalAgentProfile> {
        return firstProfileOf(await this.entityManager.findOne(AgentEntity, { where: { id: agentId, workspaceId } }))
    }

    /** The profile of the active agent that speaks for a department; null when it has none. */
    async profileOfDepartment(workspaceId: string, department: string): Promise<OptionalAgentProfile> {
        return firstProfileOf(
            await this.entityManager.findOne(AgentEntity, {
                where: { workspaceId, module: department, status: "active" },
                order: OLDEST_FIRST,
            }),
        )
    }

    /** The common regions of one module's agent dashboard. Every region is read on its own and fails on its own. */
    async dashboard(userId: string, query: DashboardQuery): Promise<AgentDashboardData> {
        const viewer = await this.members.require(userId, query.workspaceId)
        const installation = await this.installationOf(query)
        // A multi-instance type shows only its own instance's work; a single-instance type keeps reading the whole department.
        const scopeId = installation?.isMulti === true ? installation.id : null
        const installationId = installation?.id ?? null
        const [waiting, done, connections, knowledge] = await Promise.all([
            this.settle("waiting", () => this.waiting(query, scopeId, installationId)),
            this.settle("done", () => this.done(query, scopeId, installationId)),
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
        const inserted = await this.entityManager
            .createQueryBuilder(AgentEntity, "ag")
            .insert()
            .values({
                workspaceId: agent.workspaceId,
                module: agent.module,
                name: agent.name,
                handle: agent.handle,
                role: agent.role,
                instructions: agent.instructions,
            })
            .returning(
                'id, module, name, handle, role, instructions, knowledge, approval_rule AS "approvalRule", status, avatar_url AS "avatarUrl", created_at AS "createdAt"',
            )
            .execute()
            .catch((cause: unknown) => {
                if (!isUniqueViolation(cause)) throw cause
                throw new AgentsError({ code: AgentsErrorCode.HandleTaken, params: { handle: agent.handle }, cause })
            })
        const [row] = Array.isArray(inserted.raw) ? inserted.raw.filter(isAgentRecord) : []
        if (row === undefined) throw new AgentsError({ code: AgentsErrorCode.NotCreated })
        return summaryOf(row)
    }

    /** Pauses or resumes an agent; a manager only. A caller that writes more rows with it passes its transaction's manager. */
    async setStatus(
        userId: string,
        workspaceId: string,
        agentId: string,
        active: boolean,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        this.expectChanged(
            await manager.update(AgentEntity, { id: agentId, workspaceId }, { status: active ? "active" : "paused" }),
            agentId,
        )
    }

    /** Replaces the free texts of an agent (the setup chat applies a context version this way); a manager only. */
    async setTexts(userId: string, workspaceId: string, agentId: string, texts: AgentTexts): Promise<void> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        this.expectChanged(
            await this.entityManager.update(
                AgentEntity,
                { id: agentId, workspaceId },
                { instructions: texts.instructions, knowledge: texts.knowledge },
            ),
            agentId,
        )
    }

    /** Who answers for an agent now: its owner, else its fallback, else the workspace owner (see AgentOwnershipService). */
    ownerOf(agentId: string): Promise<AgentOwners> {
        return this.ownership.ownerOf(agentId)
    }

    /** Whether an agent may pass work to another agent (see AgentOwnershipService). */
    canTag(agentId: string, targetAgentId: string): Promise<boolean> {
        return this.ownership.canTag(agentId, targetAgentId)
    }

    /** Whether a member may hand an agent work (see AgentOwnershipService). */
    canAssign(memberId: string, agentId: string): Promise<boolean> {
        return this.ownership.canAssign(memberId, agentId)
    }

    private expectChanged(result: UpdateResult, agentId: string): void {
        if ((result.affected ?? 0) === 0)
            throw new AgentsError({ code: AgentsErrorCode.AgentNotFound, params: { id: agentId } })
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

    private async waiting(
        query: DashboardQuery,
        scopeId: string | null,
        installationId: string | null,
    ): Promise<WaitingData> {
        const rows = await this.work.dashboardList({
            workspaceId: query.workspaceId,
            department: query.module,
            installationId: scopeId,
            kind: "waiting",
            since: null,
            testRunPattern: TEST_RUN_PATTERN,
            limit: LIST_LIMIT,
        })
        return {
            total: totalOf(rows),
            items: rows.map((row) => itemOf(row, decisionHrefOf(query.module, installationId, row.id))),
        }
    }

    private async done(
        query: DashboardQuery,
        scopeId: string | null,
        installationId: string | null,
    ): Promise<DoneData> {
        const since = new Date(this.clock.now().getTime() - DONE_WINDOW_DAYS * DAY_MS)
        const rows = await this.work.dashboardList({
            workspaceId: query.workspaceId,
            department: query.module,
            installationId: scopeId,
            kind: "done",
            since,
            testRunPattern: TEST_RUN_PATTERN,
            limit: LIST_LIMIT,
        })
        return {
            count: totalOf(rows),
            items: rows.map((row) => itemOf(row, decisionHrefOf(query.module, installationId, row.id))),
        }
    }

    private connectionsOf(agentId: OptionalId): Promise<ReadonlyArray<BoundConnectionView>> {
        return agentId === null ? Promise.resolve([]) : this.bindings.connectionsFor(agentId, DASHBOARD_PURPOSES)
    }

    private async knowledgeOf(
        query: DashboardQuery,
        installation: OptionalInstallation,
        manager: boolean,
    ): Promise<KnowledgeData> {
        const installationId = installation?.id ?? null
        const lens = this.knowledgeLens()
        const counts = await lens.countsFor(query.workspaceId, query.module, installationId)
        // The gaps are manager-only and may not be kept at all: either way the region simply has no gaps block.
        const gaps = manager ? await lens.openGapsOf(query.workspaceId, query.module, GAP_LIMIT) : null
        return knowledgeOf(counts, gaps)
    }

    /** The knowledge lens the full mode binds; the setup mode binds none, so its knowledge region fails on its own. */
    private knowledgeLens(): KnowledgeLens {
        if (this.knowledge === null) throw new AgentsError({ code: AgentsErrorCode.KnowledgeUnbound })
        return this.knowledge
    }
}
