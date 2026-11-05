import { cursorScopeOf } from "@nivo-lite/agent-sdk/query"
import type { Query } from "@nivo-lite/agent-sdk/query"
import type { EntitiesApi, EntityApi } from "@nivo-lite/agent-sdk/entity/port"

/**
 * The scope a generic list's cursor is bound to: the entity, the condition and the order, so a cursor minted for one list is refused on
 * another. (A named list read binds its cursor with `cursorScopeOf(read, filters, sort)` itself.)
 */
export const listScopeOf = (query: Query): string =>
    cursorScopeOf(query.from, { where: JSON.stringify(query.where ?? null) }, JSON.stringify(query.order))

/** The data port of one entity: the multi-entity handle with the entity name applied. */
export const entityApiOf = (api: EntitiesApi, entity: string): EntityApi => ({
    get: (id) => api.get(entity, id),
    list: (query) => api.list({ ...query, from: entity }),
    aggregate: (aggregate) => api.aggregate({ ...aggregate, from: entity }),
    insert: (values, links) => api.insert(entity, values, links),
    update: (key, expected, values) => api.update(entity, key, expected, values),
    upsert: (on, values) => api.upsert(entity, on, values),
    ensure: (match, values) => api.ensure(entity, match, values),
    delete: (key, expected) => api.delete(entity, key, expected),
    link: (key, relation, to) => api.link(entity, key, relation, to),
    unlink: (key, relation, to) => api.unlink(entity, key, relation, to),
})
