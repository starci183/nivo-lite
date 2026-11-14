import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import type { EffectInsert, EffectJson, EffectResettle, NodeEffectStore, StoredEffect } from "./node-effect-store.port"
import { NodeEffectEntity } from "./persistence/entities"

const jsonOf = (value: object | null): EffectJson | null => (value !== null && isRecord(value) ? value : null)

/** A ledger row as the store hands it out. */
export const storedEffectOf = (row: NodeEffectEntity): StoredEffect => ({
    effectKey: row.effectKey,
    effectId: row.effectId,
    subjectEntity: row.subjectEntity,
    subjectId: row.subjectId,
    undoneAt: row.undoneAt === null ? null : row.undoneAt.toISOString(),
    runId: row.runId,
    stepKey: row.stepKey,
    args: jsonOf(row.args),
    facts: jsonOf(row.facts),
    createdAt: row.createdAt.toISOString(),
})

@Injectable()
/** The effect ledger on public.agent_node_effects, on the primary connection; every write is one statement. No raw SQL. */
export class TypeormNodeEffectStore implements NodeEffectStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The row of a ledger key, or null. */
    async byKey(workspaceId: string, effectKey: string): Promise<StoredEffect | null> {
        const row = await this.entityManager.findOne(NodeEffectEntity, { where: { workspaceId, effectKey } })
        return row === null ? null : storedEffectOf(row)
    }

    /** The rows of one run step, oldest first, at most `limit`. */
    async ofStep(
        workspaceId: string,
        runId: string,
        stepKey: string,
        limit: number,
    ): Promise<ReadonlyArray<StoredEffect>> {
        const rows = await this.entityManager.find(NodeEffectEntity, {
            where: { workspaceId, runId, stepKey },
            order: { createdAt: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((item) => storedEffectOf(item))
    }

    /** Writes the row of a key once: true when this call wrote it. */
    async insert(workspaceId: string, effect: EffectInsert): Promise<boolean> {
        const result = await this.entityManager
            .createQueryBuilder(NodeEffectEntity, "effect")
            .insert()
            .values({
                workspaceId,
                ...effect,
                args: effect.args === null ? null : structuredClone({ ...effect.args }),
                facts: effect.facts === null ? null : structuredClone({ ...effect.facts }),
            })
            .orIgnore()
            .returning(["id"])
            .execute()
        // Postgres answers the inserted rows: none when another try wrote the key first.
        const returned: unknown = result.raw
        return Array.isArray(returned) && returned.length > 0
    }

    /** Settles again a row kept as outcome-unknown, in one conditional statement: true when this call moved it. */
    async resettle(workspaceId: string, effectKey: string, unknownKind: string, subject: EffectResettle): Promise<boolean> {
        const result = await this.entityManager.update(
            NodeEffectEntity,
            { workspaceId, effectKey, subjectEntity: unknownKind },
            {
                subjectEntity: subject.subjectEntity,
                subjectId: subject.subjectId,
                facts: subject.facts === null ? null : structuredClone({ ...subject.facts }),
            },
        )
        return (result.affected ?? 0) > 0
    }
}
