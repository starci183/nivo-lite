import type { RuleMode } from "../decisions.contracts"
import type { JsonValue } from "../decisions-views.contracts"

/** public.modules as the catalog reads it. */
export interface ModuleRow {
    /** The module key. */
    key: string
    /** Constrained by a CHECK in the table. */
    audience: "customer" | "internal"
    /** True when a workspace may install several agents of the type. */
    multi_instance: boolean
    /** The whole module.json. */
    definition: JsonValue
}

/** public.authority_actions as the catalog reads it, with the follow-up actions of its module definition. */
export interface ActionRow {
    /** The action key. */
    action: string
    /** The module that performs it. */
    module_key: string
    /** Constrained by a CHECK in the table. */
    max_mode: RuleMode | null
    /** The label in both languages. */
    label: JsonValue
    /** The actions queued after this one, from the module definition. */
    next: Array<string>
}
