import { returnedRows, rowShape } from "@modules/platform/database"
import type { IncludeSpec } from "@nivo-lite/agent-sdk/query"
import { RecordEntity, RecordLinkEntity } from "../persistence/entities"
import { entityOf, relationOf } from "./catalog-access.policy"
import type { EntityCatalog, RecordRow } from "./compiler.contracts"
import { fieldExpression } from "./field-access.policy"
import { paramBag } from "./param-bag.policy"
import { onlyRecord, projectRecord, recordRowsOf, recordSelection } from "./record-row.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

const isParented = rowShape({ parent_id: "string" })

/**
 * The records of a toMany relation for a whole page of parents in exactly one extra statement (R77): the links of the parent ids
 * joined to their records, ranked per parent in the include's order, the first `latest` of each kept. The ranking is a window
 * function in a derived table because `DISTINCT ON` cannot keep more than one record per parent. The answer maps a parent id to its
 * records in order; a parent with none has no entry.
 */
export const includeRecords = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    parentEntity: string,
    spec: IncludeSpec,
    parentIds: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, ReadonlyArray<RecordRow>>> => {
    if (parentIds.length === 0) return new Map()
    const parent = entityOf(catalog, parentEntity)
    const relation = relationOf(parent, spec.relation)
    const target = entityOf(catalog, relation.target)
    const params = paramBag("p")
    const orders = spec.order.map(([field, direction]) => ({
        expression: fieldExpression(target, field, "t", params),
        sort: direction === "asc" ? ("ASC" as const) : ("DESC" as const),
    }))
    const ranking = orders.map(({ expression, sort }) => `${expression} ${sort}`).join(", ")
    const scoped =
        "l.workspaceId = :ws AND l.fromEntity = :parent AND l.relation = :relation AND l.toEntity = :target AND t.entity = :target AND l.fromId IN (:...parentIds)"
    const joined = "t.entity = l.toEntity AND t.id = l.toId AND t.workspaceId = l.workspaceId"
    const builder = tx.manager
        .createQueryBuilder(RecordLinkEntity, "l")
        .innerJoin(RecordEntity, "t", joined)
        .select("l.fromId", "parent_id")
        .orderBy("l.fromId", "ASC")
    recordSelection("t").forEach(([path, alias]) => builder.addSelect(path, alias))
    orders.forEach(({ expression, sort }, index) => {
        builder.addSelect(expression, `o${String(index)}`).addOrderBy(`o${String(index)}`, sort)
    })
    const ranked = builder
        .subQuery()
        .select("x.parent_id")
        .addSelect("x.id")
        .from(
            (inner) =>
                inner
                    .select("l.fromId", "parent_id")
                    .addSelect("t.id", "id")
                    .addSelect(`ROW_NUMBER() OVER (PARTITION BY l.fromId ORDER BY ${ranking})`, "rn")
                    .from(RecordLinkEntity, "l")
                    .innerJoin(RecordEntity, "t", joined)
                    .where(scoped),
            "x",
        )
        .where("x.rn <= :latest")
    builder.where(`l.workspaceId = :ws AND (l.fromId, t.id) IN ${ranked.getQuery()}`).setParameters({
        ...params.values(),
        ws: tx.workspaceId,
        parent: parent.name,
        relation: spec.relation,
        target: target.name,
        parentIds,
        latest: spec.latest,
    })
    const grouped = new Map<string, Array<RecordRow>>()
    returnedRows(await builder.getRawMany(), isParented).forEach((raw) => {
        const row = projectRecord(onlyRecord(recordRowsOf([raw])), spec.select)
        grouped.set(raw.parent_id, [...(grouped.get(raw.parent_id) ?? []), row])
    })
    return grouped
}
