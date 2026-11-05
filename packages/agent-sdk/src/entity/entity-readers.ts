import { z } from "zod"
import { EntityDefinitionError } from "./entity-error"
import type { AnyEntityDefinition } from "./entity-any.types"
import type { FieldDef, SystemField } from "./entity.types"

/** The longest sequence display value a reader accepts. */
const SEQUENCE_TEXT_MAX = 100

/** A bigint travels as a decimal string of at most 19 digits (Q4: no number precision loss). */
const BIGINT_TEXT = /^-?\d{1,19}$/

/** A version is a bigint counter in decimal text. */
const VERSION_TEXT = /^\d{1,19}$/

const INT_MIN = -2147483648
const INT_MAX = 2147483647

/** The bounded zod schema of one field's non-null value. */
const valueSchemaOf = (entity: AnyEntityDefinition, name: string, field: FieldDef): z.ZodType => {
    const at = `${entity.name}.fields.${name}`
    switch (field.kind) {
        case "uuid":
            return z.guid()
        case "text":
            if (field.maxLength === undefined) throw new EntityDefinitionError("ENTITY_TEXT_UNBOUNDED", at)
            return z.string().max(field.maxLength)
        case "int":
            return z.number().int().min(INT_MIN).max(INT_MAX)
        case "bigint":
            return z.string().max(20).regex(BIGINT_TEXT)
        case "bool":
            return z.boolean()
        case "timestamptz":
            return z.iso.datetime({ offset: true }).max(40)
        case "date":
            return z.iso.date().max(10)
        case "jsonb":
            if (field.shape === undefined) throw new EntityDefinitionError("ENTITY_JSONB_SHAPE_MISSING", at)
            return field.shape
        case "enum":
            if (field.of === undefined) throw new EntityDefinitionError("ENTITY_ENUM_EMPTY", at)
            return z.enum(field.of)
        case "money_vnd":
            return z.number().int()
        case "sequence":
            return z.string().max(SEQUENCE_TEXT_MAX)
    }
}

/** The system fields of every row: ids, the version as decimal text, times as ISO text. */
const SYSTEM_SHAPE: Readonly<Record<SystemField, z.ZodType>> = {
    id: z.guid(),
    workspaceId: z.guid(),
    version: z.string().max(20).regex(VERSION_TEXT),
    createdAt: z.iso.datetime({ offset: true }).max(40),
    updatedAt: z.iso.datetime({ offset: true }).max(40),
}

/**
 * The strict zod object of a row of the entity (`RowOf`): the system fields (`version` as decimal text), then every declared field
 * bounded (R305), enums closed, jsonb through its declared shape, a nullable field `nullable`. A selected subset is
 * `rowSchemaOf(entity).pick({ id: true })`. Throws `EntityDefinitionError` for a text without a bound, an enum without values or a
 * jsonb without a shape.
 */
export const rowSchemaOf = (entity: AnyEntityDefinition): z.ZodObject<Record<string, z.ZodType>> => {
    const shape: Record<string, z.ZodType> = { ...SYSTEM_SHAPE }
    for (const [name, field] of Object.entries(entity.fields)) {
        const value = valueSchemaOf(entity, name, field)
        shape[name] = field.nullable ? value.nullable() : value
    }
    return z.strictObject(shape)
}
