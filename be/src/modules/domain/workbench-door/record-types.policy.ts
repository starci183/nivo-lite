import { z } from "zod"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { moduleKeyOfName } from "@nivo-lite/agent-sdk/schema"
import type { RecordModuleView } from "./record-types.contracts"

/** What the listing reads of a module's declaration: the reads and actions the workbench door may serve. */
export type RecordModuleDeclaration = Pick<ModuleDeclaration, "reads" | "actions">

/** The JSON Schema of a read's variables or an action's input (draft 2020-12, as the MCP surface advertises schemas). */
const jsonSchemaOf = (schema: z.ZodType): Readonly<Record<string, unknown>> => {
    const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" })
    return rest
}

/**
 * The record types of the installed modules (each module = an agent template the workspace installed), each with a summary of its
 * declared fields, and the declared reads and actions of the module that the workbench door serves (those that run in the package:
 * `execute`), with the permission each needs and the JSON Schema of what it takes. A person reads records through those reads and writes
 * them through those actions (`workbench.read` / `workbench.action`), as their rights reach them. The engine's own bookkeeping types are
 * never listed; a module no installed plugin declares is left out.
 */
export const recordModulesOf = (
    moduleKeys: ReadonlyArray<string>,
    declarationOf: (moduleKey: string) => RecordModuleDeclaration | null,
    entities: ReadonlyArray<EntityDefinition>,
): ReadonlyArray<RecordModuleView> =>
    [...new Set(moduleKeys)].flatMap((module) => {
        const declaration = declarationOf(module)
        if (declaration === null) return []
        return [
            {
                module,
                types: entities
                    .filter((entity) => moduleKeyOfName(entity.name) === module)
                    .map((entity) => ({
                        name: entity.name,
                        fields: Object.entries(entity.fields).map(([name, field]) => ({
                            name,
                            kind: field.kind,
                            nullable: field.nullable,
                            values: field.of === undefined ? null : [...field.of],
                        })),
                    })),
                reads: declaration.reads
                    .filter((read) => read.execute !== undefined)
                    .map((read) => ({
                        id: read.id,
                        dataKind: read.dataKind,
                        shape: read.shape,
                        permission: read.permission,
                        variables: jsonSchemaOf(read.variables),
                    })),
                actions: declaration.actions
                    .filter((action) => action.execute !== undefined)
                    .map((action) => ({
                        id: action.id,
                        permission: action.permission,
                        input: action.input === undefined ? null : jsonSchemaOf(action.input),
                    })),
            },
        ]
    })
