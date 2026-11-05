import { RecordLinkEntity } from "../persistence/entities"
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
