import type { JsonValue, Namespaced, SpecText } from "../schema/schema.types"
import type { ReadVariables } from "../block/block.types"

/** The schema id of a spec document; a document under another id is refused. */
export type SpecSchemaId = "nivo/workbench-spec@2"

/** A binding of a read slot to a registered read, narrowed by a dotted path into its data. */
export interface SpecReadBinding {
    /** The id of the registered read to bind. */
    readonly read: string
    /** A dotted path into the read's data (`stats.members`); the data itself when absent. */
    readonly path?: string | undefined
    /** Literal variables of the read; `$installationId` is the route's installation. */
    readonly variables?: ReadVariables | undefined
}

/** A binding of an action slot to a registered action. */
export interface SpecActionBinding {
    /** The id of the registered action to bind. */
    readonly action: string
}

/** What a block slot is bound to. */
export type SpecBinding = SpecReadBinding | SpecActionBinding

/** What a viewer needs for a node to be drawn. */
export interface SpecWhen {
    /** The permission the viewer must hold for the node to be drawn. */
    readonly permission: string
}

/** What a node whose read is forbidden does: say so in place, or draw nothing. */
export type SpecForbidden = "notice" | "hide"

/** One block of the tree. */
export interface SpecNode {
    /** Unique within its view and the document's head and foot. */
    readonly id: string
    /** The id of the block that draws this node. */
    readonly block: Namespaced
    /** The block's literal props, checked against its schema. */
    readonly props?: Readonly<Record<string, JsonValue>> | undefined
    /** The block's slots bound to reads or actions, by slot name. */
    readonly bind?: Readonly<Record<string, SpecBinding>> | undefined
    /** The nodes drawn inside this one; only a block that accepts children may have them. */
    readonly children?: ReadonlyArray<SpecNode> | undefined
    /** The condition for drawing the node; absent means always. */
    readonly when?: SpecWhen | undefined
    /** What to do when the node's read is forbidden: say so in place, or draw nothing. */
    readonly forbidden?: SpecForbidden | undefined
}

/** One tab of the workbench and the block tree it draws. */
export interface SpecView {
    /** The id of the view, unique in the document; the route selects it. */
    readonly id: string
    /** The words on the view's tab. */
    readonly label: SpecText
    /** The block tree the view draws. */
    readonly root: SpecNode
    /** A hidden view draws no tab; it is selected when its `openBy` route query is present. */
    readonly hidden?: boolean | undefined
    /** The route query that selects a hidden view. */
    readonly openBy?: string | undefined
}

/** A whole spec document, as one version of it is stored. */
export interface SpecDocument {
    /** The schema id of the document; a document under another id is refused. */
    readonly schema: SpecSchemaId
    /** The module whose workbench this spec draws. */
    readonly module: string
    /** Blocks drawn above the tabs on every view. */
    readonly head?: ReadonlyArray<SpecNode> | undefined
    /** Blocks drawn below the tabs on every view. */
    readonly foot?: ReadonlyArray<SpecNode> | undefined
    /** The tabs of the workbench, each with its block tree. */
    readonly views: ReadonlyArray<SpecView>
}

/** A document as a database row yields it: any schema id, checked by `specProblems` before it is used as a spec. */
export type StoredSpec = Omit<SpecDocument, "schema"> & {
    /** The schema id exactly as stored, which may be one this SDK does not know. */
    readonly schema: string
}

/** The codes a spec is refused with. */
export type SpecProblemCode =
    | "SPEC_SCHEMA_UNKNOWN"
    | "SPEC_NO_VIEW"
    | "SPEC_VIEW_DUPLICATE"
    | "SPEC_NODE_DUPLICATE"
    | "SPEC_TOO_DEEP"
    | "SPEC_BLOCK_UNKNOWN"
    | "SPEC_PROP_INVALID"
    | "SPEC_SLOT_UNKNOWN"
    | "SPEC_SLOT_MISSING"
    | "SPEC_BINDING_UNKNOWN"
    | "SPEC_BINDING_KIND"
    | "SPEC_BINDING_SHAPE"
    | "SPEC_BINDING_DATA_KIND"
    | "SPEC_CHILDREN_REFUSED"
    | "SPEC_CHILD_NOT_ACCEPTED"
    | "SPEC_WHEN_UNKNOWN"

/** Why a spec was refused, and where: `<view>/<node id>[.<prop path or slot>]`, `head/<id>` or `foot/<id>`. */
export interface SpecProblem {
    /** The reason the spec was refused; stable, so a caller can branch on it. */
    readonly code: SpecProblemCode
    /** Where the fault is: `<view>/<node id>[.<prop path or slot>]`, `head/<id>` or `foot/<id>`. */
    readonly at: string
}
