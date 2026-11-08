import { returnedRows } from "@modules/platform/database"
import { fieldTextOrNullOf, isRecord } from "@modules/platform/primitives"
import type { JoinedRecord, KeysetPosition, ListedRecord } from "@nivo-lite/agent-sdk/entity/port"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { RecordEntity, RecordLinkEntity } from "../persistence/entities"
import { entityOf, relationOf } from "./catalog-access.policy"
import type { EntityCatalog } from "./compiler.contracts"
import { fieldExpression } from "./field-access.policy"
import { filterFragment, type FilterScope } from "./filter.policy"
import { keysetFragment } from "./keyset.policy"
import { paramBag } from "./param-bag.policy"
import { onlyRecord, pickFields, projectRecord, recordRowsOf, recordSelection } from "./record-row.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/** What a page read needs: the query tree and the position of the last row of the previous page (decoded by the caller from its signed cursor). */
export interface ListRequest {
    /** The validated query tree. */
    readonly query: Query
    /** The position after which the page starts; null for the first page. */
    readonly after: KeysetPosition | null
}

const joinedOf = (
    raw: Readonly<Record<string, unknown>>,
    index: number,
    select: ReadonlyArray<string>,
): JoinedRecord | null => {
    const id = fieldTextOrNullOf(raw[`j${String(index)}_id`])
    const data = raw[`j${String(index)}_data`]
    return id === null || !isRecord(data) ? null : { id, data: pickFields(data, select) }
}

/**
 * One page of a list query, at most `page.size + 1` rows (the caller trims the extra one to know whether another page exists): one
 * statement over `records` pruned to the entity and the workspace, the filter, the keyset predicate, every toOne join as two left
 * joins on `record_links` and `records`, the order and the limit. The record's `data` comes whole and is projected here.
 */
export const listRecords = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    request: ListRequest,
): Promise<Array<ListedRecord>> => {
    const { query } = request
    const entity = entityOf(catalog, query.from)
    const params = paramBag("p")
    const builder = recordSelection("r").reduce(
        (selected, [path, alias]) => selected.addSelect(path, alias),
        tx.manager.createQueryBuilder(RecordEntity, "r").select([]),
    )
    const scope: FilterScope = { catalog, entity, alias: "r", params, builder, depth: 0 }
    builder.where("r.entity = :entity AND r.workspaceId = :ws", { entity: entity.name, ws: tx.workspaceId })
    if (query.where !== undefined) builder.andWhere(filterFragment(query.where, scope))
    if (request.after !== null) builder.andWhere(keysetFragment(entity, query.order, request.after, "r", params))
    const joins = Object.entries(query.join ?? {})
    joins.forEach(([relationName], index) => {
        const relation = relationOf(entity, relationName)
        const link = `l${String(index)}`
        const target = `t${String(index)}`
        builder
            .leftJoin(
                RecordLinkEntity,
                link,
                `${link}.workspaceId = r.workspaceId AND ${link}.fromEntity = r.entity AND ${link}.fromId = r.id AND ${link}.relation = :${params.bind(relationName)} AND ${link}.toEntity = :${params.bind(relation.target)}`,
            )
            .leftJoin(
                RecordEntity,
                target,
                `${target}.entity = ${link}.toEntity AND ${target}.id = ${link}.toId AND ${target}.workspaceId = r.workspaceId`,
            )
            .addSelect(`${target}.id`, `j${String(index)}_id`)
            .addSelect(`${target}.data`, `j${String(index)}_data`)
    })
    query.order.forEach(([field, direction], index) => {
        const expression = fieldExpression(entity, field, "r", params)
        const alias = `o${String(index)}`
        builder.addSelect(expression, alias).addSelect(`CAST(${expression} AS text)`, `pk${String(index)}`)
        const sort = direction === "asc" ? "ASC" : "DESC"
        if (index === 0) builder.orderBy(alias, sort)
        else builder.addOrderBy(alias, sort)
    })
    builder.setParameters(params.values()).limit(query.page.size + 1)
    return returnedRows(await builder.getRawMany(), isRecord).map((raw) => ({
        row: projectRecord(onlyRecord(recordRowsOf([raw])), query.select),
        joined: Object.fromEntries(
            joins.map(([relationName, select], index) => [relationName, joinedOf(raw, index, select)]),
        ),
        position: query.order.map((_, index) => fieldTextOrNullOf(raw[`pk${String(index)}`])),
    }))
}
