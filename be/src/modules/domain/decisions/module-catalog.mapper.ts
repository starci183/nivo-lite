import type { ModuleCommand, ActionEntry, ModuleEntry } from "./decisions.contracts"
import type { JsonValue } from "./decisions-views.contracts"
import type { ActionRow, ModuleRow } from "./persistence/module-catalog.rows"

type Json = JsonValue

interface JsonObject {
    readonly [key: string]: Json | undefined
}

interface Bilingual {
    readonly vi: string
    readonly en: string
}

const isObject = (value: Json | undefined): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: Json | undefined): string => (typeof value === "string" ? value : "")

const textsOf = (value: Json | undefined): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const bilingualOf = (value: Json | undefined): Bilingual =>
    isObject(value) ? { vi: textOf(value.vi), en: textOf(value.en) } : { vi: "", en: "" }

const commandOf = (value: JsonObject): ModuleCommand => ({
    command: textOf(value.command),
    action: textOf(value.action),
    subjectType: textOf(value.subject_type),
    requiredFields: textsOf(value.required_fields),
    description: bilingualOf(value.description),
})

const acceptsOf = (definition: Json | undefined): ReadonlyArray<ModuleCommand> => {
    const list = isObject(definition) ? definition.accepts : undefined
    return Array.isArray(list) ? list.filter(isObject).map(commandOf) : []
}

/** The part of a stored module the engine reads: its audience, instancing, name and the commands it accepts. */
export const toModuleEntry = (row: ModuleRow): ModuleEntry => ({
    key: row.key,
    audience: row.audience,
    multiInstance: row.multi_instance,
    name: bilingualOf(isObject(row.definition) ? row.definition.name : undefined),
    accepts: acceptsOf(row.definition),
})

/** The text a jsonb array element has as `jsonb_array_elements_text`: a string as itself, any other scalar or structure as its JSON. */
const jsonText = (value: Json | undefined): string => (typeof value === "string" ? value : JSON.stringify(value))

/** The actions the definition queues after one action, in the order the definition lists them (camelCase key first, then snake_case). */
const nextOf = (definition: Json | undefined, action: string): ReadonlyArray<string> => {
    const holder = isObject(definition) ? definition : {}
    const listed = holder.authorityActions ?? holder.authority_actions
    const entries = Array.isArray(listed) ? listed : []
    return entries
        .filter(isObject)
        .filter((entry) => entry.action === action)
        .flatMap((entry) => (Array.isArray(entry.next) ? entry.next.filter((item) => item !== null).map(jsonText) : []))
}

/** The part of a stored authority action the engine reads. */
export const toActionEntry = (row: ActionRow): ActionEntry => ({
    action: row.action,
    moduleKey: row.module_key,
    maxMode: row.max_mode,
    next: nextOf(row.definition, row.action),
    label: bilingualOf(row.label),
})
