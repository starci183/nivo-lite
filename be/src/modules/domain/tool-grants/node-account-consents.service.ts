import { Injectable } from "@nestjs/common"
import { IsNull, type EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    GrantMode,
    NodeAccountPolicyKey,
    NodeAccountPolicyRecord,
    NodeAccountPolicyView,
    NodePolicyOrigin,
} from "./tool-grants.contracts"
import { NodeAccountPolicyEntity } from "./persistence/entities"

/** The most grant rows one read answers. */
const CONSENT_LIMIT = 5000

/** The columns that tell one grant row from another: the unique key of public.node_account_policies. */
const ROW_KEY = ["agent_id", "workflow_id", "node_key", "connection_id", "operation"]

/**
 * The columns the owner's yes sets on a row that exists. `from_version_id` is not among them: it is provenance, the version the row
 * was FIRST derived from or agreed under, so a later yes never changes it (a new row takes the version of the yes that makes it).
 */
const AGREED_COLUMNS = ["mode", "origin", "agreed_by", "agreed_at"]

const isMode = (value: unknown): value is GrantMode => value === "auto" || value === "ask"

const isOrigin = (value: unknown): value is NodePolicyOrigin =>
    value === "template" || value === "owner" || value === "migration"

/** The stored rows as a reader takes them; a row whose mode or origin is damaged is left out, so it grants nothing. */
const viewsOf = (rows: ReadonlyArray<NodeAccountPolicyEntity>): ReadonlyArray<NodeAccountPolicyView> =>
    rows.flatMap((row) =>
        isMode(row.mode) && isOrigin(row.origin)
            ? [
                  {
                      agentId: row.agentId,
                      workflowId: row.workflowId,
                      nodeKey: row.nodeKey,
                      connectionId: row.connectionId,
                      operation: row.operation,
                      mode: row.mode,
                      origin: row.origin,
                  },
              ]
            : [],
    )

@Injectable()
/**
 * The consent side of the node-level rights (public.node_account_policies): the grant rows an activation of a workflow version writes,
 * and the reads the publish gate and the two roll-ups (an agent's rights, a provider's holders) take. A row a template's request
 * brings (the agent's ticks already granted it) is only ever added: a row that exists keeps its mode and who agreed it. A row the
 * OWNER agreed is written as agreed: it is added, or it moves the existing row to the agreed mode with who agreed and when. A row
 * written with no version (its version is made after the transaction that agreed it) is named its version ONCE by `stamp`. Nothing
 * here removes a row, and nothing here decides a call: a row that names no version grants exactly what a row that names one does.
 */
export class NodeAccountConsentsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The grant rows of one workflow of an agent. */
    async listOfWorkflow(
        workspaceId: string,
        agentId: string,
        workflowId: string,
    ): Promise<ReadonlyArray<NodeAccountPolicyView>> {
        const rows = await this.entityManager.find(NodeAccountPolicyEntity, {
            where: { workspaceId, agentId, workflowId },
            order: { nodeKey: "ASC", position: "ASC", connectionId: "ASC", operation: "ASC" },
            take: CONSENT_LIMIT,
        })
        return viewsOf(rows)
    }

    /** The grant rows of every workflow of every agent of a workspace, for the roll-ups of who holds which right. */
    async listOfWorkspace(workspaceId: string): Promise<ReadonlyArray<NodeAccountPolicyView>> {
        const rows = await this.entityManager.find(NodeAccountPolicyEntity, {
            where: { workspaceId },
            order: { agentId: "ASC", workflowId: "ASC", nodeKey: "ASC", position: "ASC", connectionId: "ASC", operation: "ASC" },
            take: CONSENT_LIMIT,
        })
        return viewsOf(rows)
    }

    /** Runs `work` in one transaction of the primary database, so a version and the rows agreed for it commit or roll back together. */
    transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
        return this.entityManager.transaction(work)
    }

    /**
     * Writes the grant rows of one activation on the caller's transaction: the rows of origin `owner` as agreed (added, or the row
     * that exists moved to the agreed mode, with who agreed and when), every other row only where none exists. The version a row
     * names is set when the row is made and by `stamp` alone afterwards: no yes, on any road, changes or removes it. Answers how
     * many rows the database wrote.
     */
    async record(manager: EntityManager, records: ReadonlyArray<NodeAccountPolicyRecord>): Promise<number> {
        const brought = records.filter((record) => record.origin !== "owner")
        const agreed = records.filter((record) => record.origin === "owner")
        const added = brought.length === 0 ? 0 : await this.write(manager, brought, null)
        const moved = agreed.length === 0 ? 0 : await this.write(manager, agreed, AGREED_COLUMNS)
        return added + moved
    }

    /**
     * Names the workflow version of rows that were written with none, ONCE: each statement updates a row only while it names no
     * version (`from_version_id IS NULL` is in the statement itself), so a row that names a version is never named another, by this
     * call or by a second one. It changes no mode, origin or agreement. Answers how many rows it named.
     */
    async stamp(manager: EntityManager, rows: ReadonlyArray<NodeAccountPolicyKey>, versionId: string): Promise<number> {
        const results = await Promise.all(
            rows.map((row) =>
                manager.update(
                    NodeAccountPolicyEntity,
                    {
                        workspaceId: row.workspaceId,
                        agentId: row.agentId,
                        workflowId: row.workflowId,
                        nodeKey: row.nodeKey,
                        connectionId: row.connectionId,
                        operation: row.operation,
                        fromVersionId: IsNull(),
                    },
                    { fromVersionId: versionId },
                ),
            ),
        )
        return results.reduce((sum, result) => sum + (result.affected ?? 0), 0)
    }

    /** Writes rows where none exists; `overwrite` names the columns a row that exists takes from the record, or null to leave it as it is. */
    private async write(
        manager: EntityManager,
        records: ReadonlyArray<NodeAccountPolicyRecord>,
        overwrite: ReadonlyArray<string> | null,
    ): Promise<number> {
        const now = this.clock.now()
        const insert = manager
            .createQueryBuilder(NodeAccountPolicyEntity, "nap")
            .insert()
            .values(
                records.map((record) => ({
                    workspaceId: record.workspaceId,
                    agentId: record.agentId,
                    workflowId: record.workflowId,
                    nodeKey: record.nodeKey,
                    connectionId: record.connectionId,
                    operation: record.operation,
                    position: record.position ?? 0,
                    mode: record.mode,
                    origin: record.origin,
                    fromVersionId: record.fromVersionId,
                    agreedBy: record.agreedBy,
                    agreedAt: record.agreedBy === null ? null : now,
                })),
            )
        const result = await (overwrite === null ? insert.orIgnore() : insert.orUpdate([...overwrite], ROW_KEY))
            .returning("id")
            .execute()
        const written: unknown = result.raw
        return Array.isArray(written) ? written.length : 0
    }
}
