import { RecordLinkEntity } from "../persistence/entities"
import { getRecord } from "./get-record.policy"
import { entityOf, relationOf } from "./catalog-access.policy"
import type { EntityCatalog } from "./compiler.contracts"
import type { ScopedTx } from "./scoped-tx.contracts"

/** One link between two records through a declared relation. */
export interface LinkInput {
    /** The source entity name. */
    readonly entity: string
    /** The source record id. */
    readonly id: string
    /** The relation name declared on the source entity. */
    readonly relation: string
    /** The target record id (of the relation's target entity). */
    readonly toId: string
}

/**
 * Whether the target a link names is a LIVE record: a record that does not exist, is soft-deleted (owner order 2026-11-14: nothing is
 * hard-deleted, and a deleted record is `not_found` for a link as it is for an update) or is another agent's in a scope confined to one
 * agent is not linkable. The caller refuses before it writes anything.
 */
export const linkTargetIsLive = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    input: { readonly entity: string; readonly relation: string; readonly toId: string },
): Promise<boolean> => {
    const relation = relationOf(entityOf(catalog, input.entity), input.relation)
    return (await getRecord(tx, relation.target, input.toId)) !== null
}

/**
 * Links a record to a target through a relation. A toOne relation holds one link, so the existing one is removed first; linking
 * the same pair twice is a no-op (`ON CONFLICT DO NOTHING`). The foreign keys refuse a target that is not a record of the same workspace.
 */
export const linkRecords = async (tx: ScopedTx, catalog: EntityCatalog, input: LinkInput): Promise<void> => {
    const entity = entityOf(catalog, input.entity)
    const relation = relationOf(entity, input.relation)
    const from = { workspaceId: tx.workspaceId, fromEntity: entity.name, fromId: input.id, relation: input.relation }
    if (relation.kind === "toOne")
        await tx.manager.createQueryBuilder(RecordLinkEntity, "k").delete().from(RecordLinkEntity).where(from).execute()
    await tx.manager
        .createQueryBuilder(RecordLinkEntity, "k")
        .insert()
        .into(RecordLinkEntity)
        .values({ ...from, toEntity: relation.target, toId: input.toId })
        .orIgnore()
        .execute()
}

/** Removes the link of a record to one target through a relation; removing a link that is not there is a no-op. */
export const unlinkRecords = async (tx: ScopedTx, catalog: EntityCatalog, input: LinkInput): Promise<void> => {
    const entity = entityOf(catalog, input.entity)
    const relation = relationOf(entity, input.relation)
    await tx.manager
        .createQueryBuilder(RecordLinkEntity, "k")
        .delete()
        .from(RecordLinkEntity)
        .where({
            workspaceId: tx.workspaceId,
            fromEntity: entity.name,
            fromId: input.id,
            relation: input.relation,
            toEntity: relation.target,
            toId: input.toId,
        })
        .execute()
}
