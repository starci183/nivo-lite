/**
 * The declarative workbench: DATA, stored and versioned in the host's database (like a block layout in a post), never code. A spec is a
 * tree of blocks the build-time registry knows, each with literal props and typed bindings to the reads and actions registered modules
 * expose. Anything the registry does not know is refused, so a spec can recompose a screen but never add a behaviour.
 */

/** The schema id of a spec document; a document under another id is refused. */
export type WorkbenchSpecSchema = "nivo/workbench-spec@1"

/** A text a spec shows: a message key of the module's namespace, or words the owner wrote in both product languages. */
export type WorkbenchSpecText = { readonly key: string } | { readonly vi: string; readonly en: string }

/** A literal prop value: a scalar, a text, or a list of scalars. */
export type WorkbenchSpecValue = string | number | boolean | WorkbenchSpecText | ReadonlyArray<string | number>

/** A binding of a block slot to a read a module exposes, narrowed by a dotted path into its data. */
export interface WorkbenchSpecReadBinding {
    readonly read: string
    /** A dotted path into the read's data (`stats.members`); the data itself when absent. */
    readonly path?: string
}

/** A binding of a block slot to an action a module exposes. */
export interface WorkbenchSpecActionBinding {
    readonly action: string
}

/** What a block slot is bound to. */
export type WorkbenchSpecBinding = WorkbenchSpecReadBinding | WorkbenchSpecActionBinding

/** One block of the tree. */
export interface WorkbenchSpecNode {
    /** Unique within its view; the composer and the version diff address a block by it. */
    readonly id: string
    /** The registered block name (`figures`, `record-list`, `stack`). */
    readonly block: string
    readonly props?: Readonly<Record<string, WorkbenchSpecValue>>
    readonly bind?: Readonly<Record<string, WorkbenchSpecBinding>>
    readonly children?: ReadonlyArray<WorkbenchSpecNode>
}

/** One tab of the workbench and the block tree it draws. */
export interface WorkbenchSpecView {
    readonly id: string
    readonly label: WorkbenchSpecText
    readonly root: WorkbenchSpecNode
}

/** A whole spec document, as one version of it is stored. */
export interface WorkbenchSpecDocument {
    readonly schema: WorkbenchSpecSchema
    /** The module whose workbench this spec draws; its namespace and its exposed bindings are the ones it may use. */
    readonly module: string
    readonly views: ReadonlyArray<WorkbenchSpecView>
}

/** A document as a database row yields it: any schema id, checked by `specProblems` before it is used as a spec. */
export type WorkbenchStoredSpec = Omit<WorkbenchSpecDocument, "schema"> & { readonly schema: string }

/** The type of a block prop the registry declares. */
export type WorkbenchPropType = "string" | "number" | "boolean" | "text" | "list"

/** One prop of a registered block. */
export interface WorkbenchPropDefinition {
    readonly type: WorkbenchPropType
    readonly required: boolean
    /** The values a string prop may take; any when absent. */
    readonly oneOf?: ReadonlyArray<string>
}

/** One bindable slot of a registered block: what kind of binding, the shape of data it draws, and whether it is required. */
export interface WorkbenchSlotDefinition {
    readonly kind: "read" | "action"
    /** The shape a read must have for this slot; ignored for an action. */
    readonly shape?: WorkbenchDataShape
    readonly required: boolean
}

/** The shape of the data a read exposes, so a list is never bound where one record is drawn. */
export type WorkbenchDataShape = "record" | "list" | "value"

/** A block the registry knows: CODE in a package (an SDK block or a reviewed module block), drawn only from Grammar components. */
export interface WorkbenchBlockDefinition {
    readonly name: string
    readonly props: Readonly<Record<string, WorkbenchPropDefinition>>
    readonly slots: Readonly<Record<string, WorkbenchSlotDefinition>>
    /** Whether the block holds child blocks. */
    readonly children: boolean
}

/** A read a module exposes to specs: one host operation of its allowlist, the shape of its data and the fields a path may name. */
export interface WorkbenchReadDefinition {
    readonly name: string
    readonly module: string
    readonly operation: string
    readonly shape: WorkbenchDataShape
    /** Literal variables; `$installationId` is the route's installation. */
    readonly variables: Readonly<Record<string, string | number | boolean | null>>
    /** The dotted paths a binding may narrow to, with the shape at each; the read itself is always allowed. */
    readonly paths: Readonly<Record<string, WorkbenchDataShape>>
}

/** An action a module exposes to specs: one host command of its allowlist, run with the bound record's id. */
export interface WorkbenchActionDefinition {
    readonly name: string
    readonly module: string
    readonly operation: string
    /** The permission a viewer needs; the block draws the action disabled without it. */
    readonly permission: string
    readonly label: WorkbenchSpecText
}

/** Everything a spec may name, assembled at build time from the SDK and the registered module packages. */
export interface WorkbenchSpecRegistry {
    readonly blocks: Readonly<Record<string, WorkbenchBlockDefinition>>
    readonly reads: Readonly<Record<string, WorkbenchReadDefinition>>
    readonly actions: Readonly<Record<string, WorkbenchActionDefinition>>
}

/** The codes a spec is refused with. */
export type WorkbenchSpecProblemCode =
    | "SPEC_SCHEMA_UNKNOWN"
    | "SPEC_NO_VIEW"
    | "SPEC_VIEW_DUPLICATE"
    | "SPEC_NODE_DUPLICATE"
    | "SPEC_TOO_DEEP"
    | "SPEC_BLOCK_UNKNOWN"
    | "SPEC_PROP_UNKNOWN"
    | "SPEC_PROP_MISSING"
    | "SPEC_PROP_TYPE"
    | "SPEC_SLOT_UNKNOWN"
    | "SPEC_SLOT_MISSING"
    | "SPEC_BINDING_UNKNOWN"
    | "SPEC_BINDING_KIND"
    | "SPEC_BINDING_FOREIGN"
    | "SPEC_BINDING_SHAPE"
    | "SPEC_CHILDREN_REFUSED"

/** Why a spec was refused, and where: `<view>/<node id>[.<prop or slot>]`. */
export interface WorkbenchSpecProblem {
    readonly code: WorkbenchSpecProblemCode
    readonly at: string
}
