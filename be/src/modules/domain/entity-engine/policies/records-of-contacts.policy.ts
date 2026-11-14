import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { FilterExpr } from "@nivo-lite/agent-sdk/query"
import { RecordEntity } from "../persistence/entities"
import type { EntityCatalog } from "./compiler.contracts"
import { filterFragment, type FilterScope } from "./filter.policy"
import { paramBag } from "./param-bag.policy"
import { recordRowOfEntity } from "./record-row.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/** The most contact ids one lookup compares (the query language's `in` bound). */
export const CONTACT_IDS_MAX = 500

/**
 * Every record of the type in the scope's workspace whose given contact fields hold one of the contacts, newest first, of EVERY agent
 * (the contact erase and the contacts page read across agents; the scope carries no agent). Compiled by the engine's own filter compiler
 * (`in` on each contact field, served by the field's contact index); no hand-written SQL.
 */
export const recordsOfContacts = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    entity: EntityDefinition,
    fields: ReadonlyArray<string>,
    contactIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<RecordRow>> => {
    const ids = [...new Set(contactIds)].slice(0, CONTACT_IDS_MAX)
    if (fields.length === 0 || ids.length === 0) return []
    const params = paramBag("c")
    const builder = tx.manager.createQueryBuilder(RecordEntity, "r")
    const scope: FilterScope = { catalog, entity, alias: "r", params, builder, depth: 0 }
    const filter: FilterExpr = { op: "or", of: fields.map((field): FilterExpr => ({ op: "in", field, values: ids })) }
    const found = await builder
        .where("r.entity = :entity AND r.workspaceId = :ws", { entity: entity.name, ws: tx.workspaceId })
        .andWhere(filterFragment(filter, scope))
        .setParameters(params.values())
        .orderBy("r.createdAt", "DESC")
        .addOrderBy("r.id", "DESC")
        .getMany()
    return found.map((item) => recordRowOfEntity(item))
}
