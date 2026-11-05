import type { EntityDefinition, RelationDef } from "@nivo-lite/agent-sdk/entity"
import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import type { EntityCatalog } from "./compiler.contracts"

/** The declaration of an entity, or the compiler error of a name the catalog does not hold. */
export const entityOf = (catalog: EntityCatalog, name: string): EntityDefinition => {
    const entity = catalog.get(name)
    if (entity === undefined)
        throw new EntityEngineError({ code: EntityEngineErrorCode.EntityUnknown, params: { name } })
    return entity
}

/** A relation declared on `entity`, or the compiler error of a name it does not declare. */
export const relationOf = (entity: EntityDefinition, name: string): RelationDef => {
    const relations = entity.relations
    const relation = relations !== undefined && Object.hasOwn(relations, name) ? relations[name] : undefined
    if (relation === undefined)
        throw new EntityEngineError({
            code: EntityEngineErrorCode.RelationUnknown,
            params: { entity: entity.name, name },
        })
    return relation
}
