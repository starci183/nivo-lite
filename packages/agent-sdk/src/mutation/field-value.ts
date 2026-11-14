import { z } from "zod"
import { TEXT_MAX } from "../schema/bounds"
import type { FieldDef } from "../entity/entity.types"
import { fileValueSchemaOf } from "../entity/file-ref"

/** The longest ISO timestamp a write carries. */
const TIMESTAMP_MAX = 64

/** The zod schema of the value one non-null write puts in a field of this kind. */
const kindSchema = (field: FieldDef): z.ZodType => {
    switch (field.kind) {
        case "uuid":
        case "contact":
            return z.guid()
        case "text":
            return z.string().max(field.maxLength ?? TEXT_MAX)
        case "int":
        case "money_vnd":
            return z.int()
        case "bigint":
            return z.union([
                z.int(),
                z
                    .string()
                    .max(20)
                    .regex(/^-?\d{1,19}$/),
            ])
        case "bool":
            return z.boolean()
        case "timestamptz":
            return z.iso.datetime({ offset: true }).max(TIMESTAMP_MAX)
        case "date":
            return z.iso.date().max(10)
        case "jsonb":
            return field.shape ?? z.never()
        case "enum":
            return field.of === undefined ? z.never() : z.enum(field.of)
        case "sequence":
            return z.never()
        case "file":
            return fileValueSchemaOf(field)
    }
}

/** The zod schema a write to a field is parsed through: its kind, bounds and nullability (R305). */
export const fieldValueSchema = (field: FieldDef): z.ZodType =>
    field.nullable ? kindSchema(field).nullable() : kindSchema(field)
