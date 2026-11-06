import type { JsonValue, Namespaced, SpecText } from "../schema/schema.types"
import type { ReadVariables } from "../block/block.types"

/** The schema id of a spec document; a document under another id is refused. */
export type SpecSchemaId = "nivo/workbench-spec@1"

/** A binding of a read slot to a registered read, narrowed by a dotted path into its data. */
export interface SpecReadBinding {
    /** The registry id of the read. */
    readonly read: string
    /** A dotted path into the read's data (`stats.members`); the data itself when absent. */
    readonly path?: string | undefined
    /** Variables of the read: literals, `$installationId` (the route's installation) or `"$<param>"` (the value of a spec param). */
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

/** The param values a node needs for it to be drawn: the node swaps in and out of its place as the param changes. */
export interface SpecShowWhen {
    /** The param whose value decides; the spec declares it. */
    readonly param: string
    /** The values of the param that show the node; when the param declares its values, each is one of them. */
    readonly is: ReadonlyArray<string>
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
    /** The param values that show the node; absent draws it whatever the params hold. */
    readonly showWhen?: SpecShowWhen | undefined
}

/** The count a view shows as a chip on its tab: a read of the view's size, narrowed by a path to a number. */
export interface SpecViewCount extends SpecReadBinding {
    /** Whether a count above zero reads in the attention tone (something waits for the viewer). */
    readonly isAttention?: boolean | undefined
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
    /** The count shown as a chip on the tab of the view, from a counts read; absent shows the tab with no chip. */
    readonly count?: SpecViewCount | undefined
    /** The primary command of the view, drawn as the page's primary button beside the tabs; it runs with no record. */
    readonly command?: SpecActionBinding | undefined
}

/** One param of a spec: a value of the screen that lives in the URL, which bindings take as a `$name` variable. */
export interface SpecParam {
    /** `string`: any text (a search); `enum`: one of the values of `of`. */
    readonly type: "string" | "enum"
    /** The URL query key that holds the value: the URL is the single source of truth of what the screen shows. */
    readonly url: string
    /** enum only: the allowed values, or `"<read id>.<filter name>"` / `"<read id>.sort"` naming a list read's declared values. */
    readonly of?: ReadonlyArray<string> | string | undefined
    /** The value when the URL holds none (or none that is allowed); absent means no value. */
    readonly default?: string | undefined
}

/**
 * What a phone shows of the aside on the main pane: one line that opens the aside pane. A read says how much waits (`path` reaches
 * the figure) and, optionally, what is first.
 */
export interface SpecAsideSummary extends SpecReadBinding {
    /** The words on the line (what the aside is). */
    readonly label: SpecText
    /** A dotted path to the text of the first item, drawn under the label; absent draws the label alone. */
    readonly previewPath?: string | undefined
    /** The value of the `pane` param that opens the aside pane. */
    readonly opens: string
}

/** A whole spec document, as one version of it is stored. */
export interface SpecDocument {
    /** The format of the document; another id is refused. */
    readonly schema: SpecSchemaId
    /** The module whose workbench this spec draws. */
    readonly module: string
    /** The params of the screen by name; a binding variable `"$name"` and a block prop that names a param refer to them. */
    readonly params?: Readonly<Record<string, SpecParam>> | undefined
    /** Blocks drawn above the tabs on every view. */
    readonly head?: ReadonlyArray<SpecNode> | undefined
    /** Blocks drawn below the tabs on every view. */
    readonly foot?: ReadonlyArray<SpecNode> | undefined
    /**
     * The region drawn in a pane at the right of the view on every view. On a phone the main pane and this one show one at a time: the
     * `pane` param, `list` for the main pane, names the one in view.
     */
    readonly aside?: SpecNode | undefined
    /** What the main pane of a phone shows of the aside; absent shows nothing, and the aside is reached through the `pane` param only. */
    readonly asideSummary?: SpecAsideSummary | undefined
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
    | "SPEC_PARAM_INVALID"
    | "SPEC_PARAM_UNKNOWN"
    | "SPEC_VAR_UNKNOWN"
    | "SPEC_ASIDE_MISSING"

/**
 * Why a spec was refused, and where: `<view>/<node id>[.<prop path or slot>[.<variable>]]`, `head/<id>` or `foot/<id>`; for a param
 * `params.<name>`.
 */
export interface SpecProblem {
    /** Which rule the spec broke. */
    readonly code: SpecProblemCode
    /** Where in the spec the rule was broken. */
    readonly at: string
}
