import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { FilterExpr, Scalar } from "@nivo-lite/agent-sdk/query"
import { RecordEntity } from "../persistence/entities"
import type { EntityCatalog } from "./compiler.contracts"
import { filterFragment, type FilterScope } from "./filter.policy"
import { paramBag } from "./param-bag.policy"
import { recordRowOfEntity } from "./record-row.policy"
import { keyAgentOf } from "./record-scope.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/**
 * The first record of the scope's workspace whose fields equal the given values, or null. For an agent-scoped type the lookup stays
 * inside the agent that writes (`keyAgentOf`): a declared key is unique per workspace AND agent, so another agent's record never matches.
 */
export const findRecordByFields = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    entity: EntityDefinition,
    fields: ReadonlyArray<readonly [string, Scalar]>,
): Promise<RecordRow | null> => {
    const agent = keyAgentOf(tx)
    const params = paramBag("p")
    const builder = tx.manager.createQueryBuilder(RecordEntity, "r")
    const scope: FilterScope = { catalog, entity, alias: "r", params, builder, depth: 0 }
    const filter: FilterExpr = {
        op: "and",
        of: fields.map(([field, value]): FilterExpr => ({ op: "eq", field, value })),
    }
    builder.where("r.entity = :entity AND r.workspaceId = :ws", { entity: entity.name, ws: tx.workspaceId })
    if (agent !== null) builder.andWhere("r.agentId = :agent", { agent })
    const record = await builder
        .andWhere(filterFragment(filter, scope))
        .setParameters(params.values())
        .limit(1)
        .getOne()
    return record === null ? null : recordRowOfEntity(record)
}
