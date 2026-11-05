import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { FilterExpr, Scalar } from "@nivo-lite/agent-sdk/query"
import { RecordEntity } from "../persistence/entities"
import type { EntityCatalog } from "./compiler.contracts"
import { filterFragment } from "./filter.policy"
import type { FilterScope } from "./filter.policy"
import { paramBag } from "./param-bag.policy"
import { recordRowOfEntity } from "./record-row.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/** The first record of the scope's workspace whose fields equal the given values, or null. */
export const findRecordByFields = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    entity: EntityDefinition,
    fields: ReadonlyArray<readonly [string, Scalar]>,
): Promise<RecordRow | null> => {
    const params = paramBag("p")
    const builder = tx.manager.createQueryBuilder(RecordEntity, "r")
    const scope: FilterScope = { catalog, entity, alias: "r", params, builder, depth: 0 }
    const filter: FilterExpr = {
        op: "and",
        of: fields.map(([field, value]): FilterExpr => ({ op: "eq", field, value })),
    }
    const record = await builder
        .where("r.entity = :entity AND r.workspaceId = :ws", { entity: entity.name, ws: tx.workspaceId })
        .andWhere(filterFragment(filter, scope))
        .setParameters(params.values())
        .limit(1)
        .getOne()
    return record === null ? null : recordRowOfEntity(record)
}
