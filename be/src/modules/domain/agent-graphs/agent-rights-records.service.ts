import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { EntityEngineService, type ScopedTx, type ScopedWork } from "@modules/domain/entity-engine"
import { accountsAsNodesName } from "@modules/domain/tools"
import {
    AccountAttachmentsService,
    NodeAccountConsentsService,
    type NodeAccountPolicyRecord,
} from "@modules/domain/tool-grants"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentRightsNoticesService } from "./agent-rights-notices.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import type { OptionalWorkflowVersionRecord } from "./agent-workflows.contracts"
import { positionedOf, type PlacedGraph } from "./policies/node-accounts.policy"
import type { RightsSettlement } from "./policies/node-rights-gate.policy"
import { snapshotOf } from "./policies/workflow-view.policy"

/** The most workflows of an agent the primary lookup reads. */
const WORKFLOW_LIMIT = 50

/** How many times `stampOnce` tries before it leaves the rows naming no version: the first try and one retry, in the same call. */
export const STAMP_ATTEMPTS = 2

/** Where the rows of a finished write belong. */
export interface RightsPlace {
    /** The workflow, or null when the write made none (nothing is recorded). */
    readonly workflowId: string | null
    /** The workflow version the rows were agreed for, or null when it is not known yet. */
    readonly versionId: string | null
}

/** A settlement and the running version its rows are agreed for. */
export interface SettledVersion {
    /** The settlement. */
    readonly settlement: RightsSettlement
    /** The version that asks, or null. */
    readonly versionId: string | null
}

/** The primary workflow of an agent, or null while its graph was not adopted as one. */
type OptionalWorkflowId = string | null

/** The workflow version rows are to be named, read when it is asked for; null when there is none (the rows keep naming none). */
export type VersionLookup = () => Promise<string | null>

@Injectable()
/**
 * THE RECORDING of what the rights gate settled: the grant rows an activation brings are written here and nowhere else in the
 * capability. A version and the rows agreed for it go in ONE transaction of the primary database (`run`); the activations that
 * write no version with their rows (turning a workflow on, one consent for an agent, an attachment by the template, the first flow
 * of an agent) write them in a transaction of their own. Rows whose workflow version is only made after their transaction (a
 * publish of the agent's own graph: the primary workflow mirrors the graph version once it is adopted) are written naming no
 * version and named it ONCE afterwards (`stampOnce`); a row that is never named one grants all the same. Nothing here decides
 * anything: it writes what `AgentGraphRightsService` settled, to the workflow the settlement names.
 */
export class AgentRightsRecordsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly workflows: AgentWorkflowRecordsService,
        @Optional() private readonly consents?: NodeAccountConsentsService,
        @Optional() @InjectLogger() private readonly logger?: Logger,
        @Optional() private readonly notices?: AgentRightsNoticesService,
        @Optional() private readonly access?: AccountAttachmentsService,
        @Optional() private readonly bindings?: ConnectionBindingsReadService,
    ) {}

    /** The primary workflow of an agent, or null while its graph was not adopted as one. */
    primaryOf(workspaceId: string, agentId: string): Promise<OptionalWorkflowId> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const all = await this.workflows.workflowsOf(tx, agentId, WORKFLOW_LIMIT)
            return all.find((workflow) => workflow.primary)?.id ?? null
        })
    }

    /**
     * Runs the write of a version. With no grant row to record it is the engine's own scoped transaction, exactly as before node
     * rights. With rows, the write runs in the engine scope of ONE transaction of the primary database and the rows are recorded on
     * that same transaction once the scope is left (the engine role holds no right on the grants): the version and the rows agreed
     * for it commit together or not at all.
     */
    run<T>(
        workspaceId: string,
        settlement: RightsSettlement,
        work: ScopedWork<T>,
        placeOf: (written: T) => RightsPlace,
    ): Promise<T> {
        return this.runMany(workspaceId, [settlement], work, (written) => [placeOf(written)])
    }

    /** `run` for a write that makes several versions at once (a copy of every workflow of an agent): one place per settlement, in order. */
    runMany<T>(
        workspaceId: string,
        settlements: ReadonlyArray<RightsSettlement>,
        work: ScopedWork<T>,
        placesOf: (written: T) => ReadonlyArray<RightsPlace | undefined>,
    ): Promise<T> {
        const { consents } = this
        if (consents === undefined || settlements.every((settlement) => settlement.grants.length === 0)) {
            return this.engine.scoped(workspaceId, work)
        }
        return consents.transaction(async (manager) => {
            const written = await this.engine.within(manager, workspaceId, work)
            const places = placesOf(written)
            const records = settlements.flatMap((settlement, at) => {
                const place = places[at]
                return place === undefined ? [] : this.recordsOf(workspaceId, settlement, place)
            })
            if (records.length > 0) await consents.record(manager, await this.positioned(workspaceId, records, manager))
            return written
        })
    }

    /**
     * Records the rows of a settlement in a transaction of their own, for the activations that write no version with them: the
     * owner agreeing to what a running version asks before a workflow is turned on, an attachment by the template, and a version of
     * the agent's own graph published before the agent had a primary workflow (the rows are keyed by the workflow, which only exists
     * once the graph was adopted). A failure leaves the entries not granted (they wait for the owner again), never granted without
     * a row.
     */
    async record(workspaceId: string, settlement: RightsSettlement, versionId: string | null): Promise<void> {
        const { consents } = this
        if (consents === undefined || settlement.grants.length === 0) return
        const workflowId = settlement.workflowId ?? (await this.primaryOf(workspaceId, settlement.agentId))
        if (workflowId === null) return
        const records = await this.positioned(workspaceId, this.recordsOf(workspaceId, settlement, { workflowId, versionId }))
        await consents.transaction((manager) => consents.record(manager, records))
    }

    /** `record` for a consent to what a workflow's RUNNING version asks (turning it on): the rows name that workflow version. */
    async recordRunning(workspaceId: string, settlement: RightsSettlement): Promise<void> {
        const { workflowId } = settlement
        if (workflowId === null || settlement.grants.length === 0) return
        const running = await this.engine.scoped(workspaceId, (tx) => this.workflows.workflow(tx, workflowId))
        await this.record(workspaceId, settlement, running?.activeVersionId ?? null)
    }

    /**
     * Records the rows of several settlements (one per workflow of one consent) in ONE transaction: all of them or none. Answers
     * how many rows it handed to the store; a settlement of no workflow is left out.
     */
    async recordAll(workspaceId: string, settled: ReadonlyArray<SettledVersion>): Promise<number> {
        const { consents } = this
        const records = settled.flatMap(({ settlement, versionId }) =>
            this.recordsOf(workspaceId, settlement, { workflowId: settlement.workflowId, versionId }),
        )
        if (consents === undefined || records.length === 0) return 0
        const placed = await this.positioned(workspaceId, records)
        await consents.transaction((manager) => consents.record(manager, placed))
        return records.length
    }

    /**
     * Names the rows of a settlement, written with no version, the workflow version `versionOf` answers: a provenance stamp, set
     * ONCE (a row that names a version is left as it is, so a second call changes nothing). It runs after the transaction that
     * holds the version and the rows, so it never fails them: when the lookup or the write fails it is tried again HERE, in the
     * same call, `STAMP_ATTEMPTS` times in all, and then given up: logged, and the founder is told once in the team chat
     * (`published` names the agent graph version it is told once for). The rows then keep naming no version, which grants exactly
     * the same; nothing retries later, since a later version would be the wrong one to name. Answers how many rows it named.
     */
    stampOnce(
        workspaceId: string,
        settlement: RightsSettlement,
        versionOf: VersionLookup,
        published: string | null = null,
    ): Promise<number> {
        if (this.consents === undefined || settlement.grants.length === 0) return Promise.resolve(0)
        return this.stampTry(workspaceId, settlement, versionOf, { left: STAMP_ATTEMPTS, published })
    }

    private async stampTry(
        workspaceId: string,
        settlement: RightsSettlement,
        versionOf: VersionLookup,
        { left, published }: { readonly left: number; readonly published: string | null },
    ): Promise<number> {
        const { consents } = this
        if (consents === undefined) return 0
        try {
            const versionId = await versionOf()
            const rows = this.recordsOf(workspaceId, settlement, { workflowId: settlement.workflowId, versionId })
            if (versionId === null || rows.length === 0) return 0
            return await consents.transaction((manager) => consents.stamp(manager, rows, versionId))
        } catch (cause) {
            if (left > 1) return this.stampTry(workspaceId, settlement, versionOf, { left: left - 1, published })
            const { agentId, workflowId } = settlement
            this.logger?.error(AgentGraphsLogEvent.RightsStampFailed, cause, { agentId, workflowId })
            // Unhandled never silent: the founder reads it in the team chat, once per published version.
            await this.notices?.publishUnfinished({ workspaceId, agentId, workflowId, graphVersionId: published })
            return 0
        }
    }

    private recordsOf(
        workspaceId: string,
        settlement: RightsSettlement,
        place: RightsPlace,
    ): ReadonlyArray<NodeAccountPolicyRecord> {
        const workflowId = settlement.workflowId ?? place.workflowId
        if (workflowId === null) return []
        return settlement.grants.map((grant) => ({
            workspaceId,
            agentId: settlement.agentId,
            workflowId,
            nodeKey: grant.nodeKey,
            connectionId: grant.connectionId,
            operation: grant.operation,
            mode: grant.mode,
            origin: grant.origin,
            fromVersionId: place.versionId,
            agreedBy: settlement.agreedBy,
        }))
    }

    /**
     * The records with their `position`: the place of each account's provider in its node's list, read from the graph of the version
     * the rows are agreed for (else the workflow's running, else newest version) and the agent's attachments as nodes name them (an
     * OpenAPI account by the source its pinned document serves, so a `crm` row takes the place `crm` has in its node). Only a NEW row takes it
     * (a row that exists keeps its place); nothing about who agrees to what changes here. Read on the caller's transaction when it has
     * one, so a version made in it is seen. A read that fails keeps the records as they are (place 0: order only, no right moves) and
     * is logged.
     */
    private async positioned(
        workspaceId: string,
        records: ReadonlyArray<NodeAccountPolicyRecord>,
        manager?: EntityManager,
    ): Promise<ReadonlyArray<NodeAccountPolicyRecord>> {
        const { access } = this
        if (access === undefined || records.length === 0) return records
        const agentIds = [...new Set(records.map((record) => record.agentId))]
        try {
            const attachments = await accountsAsNodesName(
                workspaceId,
                (await Promise.all(agentIds.map((agentId) => access.listOfAgent(workspaceId, agentId)))).flat(),
                this.bindings,
            )
            const places = [...new Map(records.map((record) => [record.workflowId, record.fromVersionId])).entries()]
            const read = async (tx: ScopedTx): Promise<ReadonlyMap<string, PlacedGraph>> => {
                const graphs = new Map<string, PlacedGraph>()
                await eachInOrder(places, async ([workflowId, versionId]) => {
                    const version = await this.versionOf(tx, workflowId, versionId)
                    if (version === null) return
                    graphs.set(workflowId, { nodes: snapshotOf(version).nodes })
                })
                return graphs
            }
            const graphs =
                manager === undefined
                    ? await this.engine.scoped(workspaceId, read)
                    : await this.engine.within(manager, workspaceId, read)
            return positionedOf(records, (workflowId) => graphs.get(workflowId), attachments)
        } catch (cause: unknown) {
            this.logger?.error(AgentGraphsLogEvent.NodeRightsUnreadable, cause, { workspaceId, agentIds: agentIds.join(",") })
            return records
        }
    }

    /** The version rows are placed by: the one they are agreed for, else the workflow's running one, else its newest; null for none. */
    private async versionOf(
        tx: ScopedTx,
        workflowId: string,
        versionId: string | null,
    ): Promise<OptionalWorkflowVersionRecord> {
        const named = versionId === null ? null : await this.workflows.version(tx, versionId)
        if (named !== null) return named
        const workflow = await this.workflows.workflow(tx, workflowId)
        if (workflow === null) return null
        if (workflow.activeVersionId !== null) {
            const running = await this.workflows.version(tx, workflow.activeVersionId)
            if (running !== null) return running
        }
        return (await this.workflows.versionsOf(tx, workflowId, 1)).at(0) ?? null
    }
}
