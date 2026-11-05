import { returnedRows, rowShape } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { RecordEntity, RecordLinkEntity } from "../persistence/entities"
import { entityOf } from "./catalog-access.policy"
import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import type { EntityCatalog } from "./compiler.contracts"
import type { ScopedTx } from "./scoped-tx.contracts"

/** What a delete did. */
export type DeleteOutcome =
    { readonly kind: "ok" } | { readonly kind: "missing" } | { readonly kind: "blocked"; readonly relation: string }

const isDeletedId = rowShape({ id: "string" })

/** A relation of some entity that points at the deleted entity, and whether deleting the target is refused (the default) or removes the link. */
interface IncomingRelation {
    readonly from: string
    readonly relation: string
    readonly restrict: boolean
}

const incomingOf = (catalog: EntityCatalog, entity: string): Array<IncomingRelation> =>
    [...catalog.values()].flatMap((source) =>
        Object.entries(source.relations ?? {}).flatMap(([relation, definition]) =>
            definition.target === entity
                ? [{ from: source.name, relation, restrict: definition.onDelete !== "cascade" }]
                : [],
        ),
    )

/**
 * Deletes a record of a `deletable` entity. A link that points at it through a `restrict` relation refuses the delete (`blocked`
 * names the relation); the links of `cascade` relations and the record's own outgoing links are removed first (the table's foreign
 * keys are RESTRICT), then the record. `missing` when no such record exists in the scope's workspace.
 */
export const deleteRecord = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    entityName: string,
    id: string,
): Promise<DeleteOutcome> => {
    const entity = entityOf(catalog, entityName)
    if (entity.deletable !== true)
        throw new EntityEngineError({ code: EntityEngineErrorCode.NotDeletable, params: { entity: entity.name } })
    const blockers: Array<string> = []
    await eachInOrder(
        incomingOf(catalog, entity.name).filter((incoming) => incoming.restrict),
        async ({ from, relation }) => {
            if (blockers.length > 0) return
            const linked = await tx.manager.exists(RecordLinkEntity, {
                where: { workspaceId: tx.workspaceId, fromEntity: from, relation, toEntity: entity.name, toId: id },
            })
            if (linked) blockers.push(relation)
        },
    )
    const [blocking] = blockers
    if (blocking !== undefined) return { kind: "blocked", relation: blocking }
    await tx.manager
        .createQueryBuilder(RecordLinkEntity, "k")
        .delete()
        .from(RecordLinkEntity)
        .where({ workspaceId: tx.workspaceId, toEntity: entity.name, toId: id })
        .execute()
    await tx.manager
        .createQueryBuilder(RecordLinkEntity, "k")
        .delete()
        .from(RecordLinkEntity)
        .where({ workspaceId: tx.workspaceId, fromEntity: entity.name, fromId: id })
        .execute()
    const result = await tx.manager
        .createQueryBuilder(RecordEntity, "r")
        .delete()
        .from(RecordEntity)
        .where({ entity: entity.name, id, workspaceId: tx.workspaceId })
        .returning("id")
        .execute()
    return returnedRows(result.raw, isDeletedId).length === 0 ? { kind: "missing" } : { kind: "ok" }
}
