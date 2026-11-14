/** One declared field of a record type, summarised. */
export interface RecordFieldView {
    /** The field's name. */
    readonly name: string
    /** Its kind (text, int, money_vnd, bool, enum, timestamp, jsonb, file, contact, …). */
    readonly kind: string
    /** Whether it may be absent or null. */
    readonly nullable: boolean
    /** An enum's allowed values, else null. */
    readonly values: ReadonlyArray<string> | null
}

/** One record type (`<package>.<agent>.<domain>`). */
export interface RecordTypeView {
    /** The type's name. */
    readonly name: string
    /** Its declared fields. */
    readonly fields: ReadonlyArray<RecordFieldView>
}

/** One declared read of a module the workbench door serves. */
export interface RecordReadView {
    /** The read's id (what `workbench.read` names). */
    readonly id: string
    /** The kind of data it yields. */
    readonly dataKind: string
    /** One record or a list. */
    readonly shape: string
    /** The member permission it needs. */
    readonly permission: string
    /** The JSON Schema of its variables. */
    readonly variables: Readonly<Record<string, unknown>>
}

/** One declared action of a module the workbench door serves. */
export interface RecordActionView {
    /** The action's id (what `workbench.action` names). */
    readonly id: string
    /** The member permission it needs. */
    readonly permission: string
    /** The JSON Schema of its input, or null when it takes none. */
    readonly input: Readonly<Record<string, unknown>> | null
}

/** One installed module (agent template) with its record types, reads and actions. */
export interface RecordModuleView {
    /** The module key (the `<agent>` of its names). */
    readonly module: string
    /** Its record types. */
    readonly types: ReadonlyArray<RecordTypeView>
    /** Its reads the door serves. */
    readonly reads: ReadonlyArray<RecordReadView>
    /** Its actions the door serves. */
    readonly actions: ReadonlyArray<RecordActionView>
}
