import type { JsonValue, Namespaced, SpecText } from "../schema/schema.types"
import type { ReadVariables } from "../block/block.types"

/** The schema id of a spec document; a document under another id is refused. */
export type SpecSchemaId = "nivo/workbench-spec@2"

/** A binding of a read slot to a registered read, narrowed by a dotted path into its data. */
export interface SpecReadBinding {
    /** The registry id of the read. */
    readonly read: string
    /** A dotted path into the read's data (`stats.members`); the data itself when absent. */
    readonly path?: string | undefined
    /** Literal variables of the read; `$installationId` is the route's installation. */
    readonly variables?: ReadVariables | undefined
}

/** A binding of an action slot to a registered action. */
export interface SpecActionBinding {
    /** The registry id of the action. */
    readonly action: string
}

/** What a block slot is bound to. */
export type SpecBinding = SpecReadBinding | SpecActionBinding

/** What a viewer needs for a node to be drawn. */
export interface SpecWhen {
    /** The member permission the viewer must hold. */
    readonly permission: string
}

/** What a node whose read is forbidden does: say so in place, or draw nothing. */
export type SpecForbidden = "notice" | "hide"

/** One block of the tree. */
export interface SpecNode {
    /** Unique within its view and the document's head and foot. */
    readonly id: string
    /** The registry id of the block the node draws. */
    readonly block: Namespaced
    /** The literal props of the block; absent leaves every prop at its default. */
    readonly props?: Readonly<Record<string, JsonValue>> | undefined
    /** What each slot of the block is bound to, by slot name. */
    readonly bind?: Readonly<Record<string, SpecBinding>> | undefined
    /** The child nodes, for a block that holds children. */
    readonly children?: ReadonlyArray<SpecNode> | undefined
    /** What the viewer needs for the node to be drawn; absent draws it for everyone. */
    readonly when?: SpecWhen | undefined
    /** What the node does when a read of it is forbidden; absent says so in place. */
    readonly forbidden?: SpecForbidden | undefined
}

/** One tab of the workbench and the block tree it draws. */
export interface SpecView {
    /** The id of the view, which a deep link names; unique within the document. */
    readonly id: string
    /** The words on the tab of the view. */
    readonly label: SpecText
    /** The block tree of the view. */
    readonly root: SpecNode
    /** A hidden view draws no tab; it is selected when its `openBy` route query is present. */
    readonly hidden?: boolean | undefined
    /** The route query key that selects the view when it is present. */
    readonly openBy?: string | undefined
}

/** A whole spec document, as one version of it is stored. */
export interface SpecDocument {
    /** The format of the document; another id is refused. */
    readonly schema: SpecSchemaId
    /** The module whose workbench this spec draws. */
    readonly module: string
    /** Blocks drawn above the tabs on every view. */
    readonly head?: ReadonlyArray<SpecNode> | undefined
    /** Blocks drawn below the tabs on every view. */
    readonly foot?: ReadonlyArray<SpecNode> | undefined
    /** The tabs of the workbench and the block tree each draws. */
    readonly views: ReadonlyArray<SpecView>
}

/** A document as a database row yields it: any schema id, checked by `specProblems` before it is used as a spec. */
export type StoredSpec = Omit<SpecDocument, "schema"> & {
    /** The schema id the row carries, whatever it is; `specProblems` refuses one that is not the current id. */
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
    /** Which rule the spec broke. */
    readonly code: SpecProblemCode
    /** Where in the spec the rule was broken. */
    readonly at: string
}
