import type { z } from "zod"
import type { DataShape, JsonSchema, Namespaced, PropsSchema, SpecLocale, SpecText } from "../schema/schema.types"
import type { DataSlot } from "../slot/slot.types"

/** A read slot of a block: the data a spec binds to it. */
export interface BlockReadSlot {
    /** Marks the slot as one a spec binds to a read. */
    readonly kind: "read"
    /** The shape the bound read must have. */
    readonly shape: DataShape
    /** Whether a spec that leaves the slot unbound is refused. */
    readonly required: boolean
    /** When set, a bound read must yield this data kind. */
    readonly dataKind?: string
}

/** An action slot of a block: a command a spec binds to it. */
export interface BlockActionSlot {
    /** Marks the slot as one a spec binds to a command. */
    readonly kind: "action"
    /** Whether a spec that leaves the slot unbound is refused. */
    readonly required: boolean
}

/** One bindable slot of a block. */
export type BlockSlot = BlockReadSlot | BlockActionSlot

/** The slots of a block by name. */
export type BlockSlots = Readonly<Record<string, BlockSlot>>

/** Whether a block holds child blocks: `false`, or a bound on how many and of which ids. */
export type BlockChildren = false | { readonly max?: number; readonly accepts?: ReadonlyArray<Namespaced> }

/** What `defineBlock` takes. */
export interface BlockConfig<P extends PropsSchema, S extends BlockSlots> {
    /** The registry id a spec names the block by; unique across every package. */
    readonly id: Namespaced
    /** The name the composer palette shows for the block. */
    readonly title: SpecText
    /** The literal props a spec may set; every member must convert with `z.toJSONSchema`. */
    readonly props: P
    /** The reads and actions a spec may bind to the block. */
    readonly slots: S
    /** Whether the block holds child blocks, and how many of which ids. */
    readonly children: BlockChildren
}

/** A block definition: React-free data and a zod schema. Its component is registered apart, on the client side. */
export interface BlockDefinition<
    P extends PropsSchema = PropsSchema,
    S extends BlockSlots = BlockSlots,
> extends BlockConfig<P, S> {
    /** Tells a block from a read or an action in the registry. */
    readonly entry: "block"
    /** `z.toJSONSchema(props)`, computed once. */
    readonly propsJson: JsonSchema
}

/** What `defineRead` takes: a data source a spec binds a read slot to, run under the VIEWER's session and rights. */
export interface ReadConfig<V extends PropsSchema> {
    /** The registry id a spec binds the read by; unique across every package. */
    readonly id: Namespaced
    /** The kind of data the read yields, which a slot may demand of the read bound to it. */
    readonly dataKind: string
    /** Whether the read yields one record or a list. */
    readonly shape: DataShape
    /** What the read returns; a binding path must start with one. */
    readonly fields: ReadonlyArray<string>
    /** The dotted paths a binding may narrow to, with the shape at each. */
    readonly paths: Readonly<Record<string, DataShape>>
    /** The literal variables a spec may set; `$installationId` is the route's. */
    readonly variables: V
    /** The host operation name, on the host's allowlist. */
    readonly operation: string
    /** The member permission a viewer needs; a forbidden slot without it. */
    readonly permission: string
}

/** A registered read, as the registry holds it after `defineRead` checked it. */
export interface ReadDefinition<V extends PropsSchema = PropsSchema> extends ReadConfig<V> {
    /** Tells a read from a block or an action in the registry. */
    readonly entry: "read"
}

/** What `defineAction` takes: a host command run with the bound record's id. */
export interface ActionConfig {
    /** The registry id a spec binds the action by; unique across every package. */
    readonly id: Namespaced
    /** The host operation name, on the host's allowlist. */
    readonly operation: string
    /** The member permission a viewer needs to run the action. */
    readonly permission: string
    /** The words on the control that runs the action. */
    readonly label: SpecText
}

/** A registered action, as the registry holds it after `defineAction` checked it. */
export interface ActionDefinition extends ActionConfig {
    /** Tells an action from a block or a read in the registry. */
    readonly entry: "action"
}

/** The variables of a read: literals a spec or a block sets. */
export type ReadVariables = Readonly<Record<string, string | number | boolean | null>>

/** Paging of a read: more rows, loaded on request. */
export interface ReadPage {
    /** Whether the read has rows beyond those loaded. */
    readonly hasMore: boolean
    /** Whether the next rows are loading now. */
    readonly isLoadingMore: boolean
    /** Whether loading the next rows failed, so a block can offer to try again. */
    readonly failure: boolean
    /** Loads the next rows and appends them to the slot. */
    readonly loadMore: () => void
}

/** What a block receives for a read slot: the slot, the way to read it again, its variables and its paging. */
export interface ReadHandle<T = unknown> {
    /** The status of the read: what the block draws. */
    readonly slot: DataSlot<T>
    /** Reads the data again after a failure. */
    readonly retry: () => void
    /** The literal variables the read runs with now. */
    readonly variables: ReadVariables
    /** Runs the read again with other variables, for instance a search term. */
    readonly setVariables: (variables: ReadVariables) => void
    /** The paging of the read; null when the read is not paged. */
    readonly page: ReadPage | null
}

/** What running an action yields. */
export type ActionOutcome =
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: "invalid"; readonly fields: Readonly<Record<string, SpecText>> }
    | { readonly ok: false; readonly reason: "forbidden" | "conflict" | "failed"; readonly message: SpecText }

/** What a block hands an action: the record, an optional row command and form values. */
export interface ActionInput {
    /** The id of the record the action runs on. */
    readonly id: string
    /** The row command to run, when the action offers several. */
    readonly command?: string
    /** The values of the form the person filled, by field. */
    readonly values?: Readonly<Record<string, string | number | boolean | null>>
}

/** What a block receives for an action slot. */
export interface ActionHandle {
    /** Runs the action with the given input and says how it ended. */
    readonly run: (input: ActionInput) => Promise<ActionOutcome>
    /** Whether the viewer holds the permission the action needs. */
    readonly isAllowed: boolean
    /** Whether a run is in flight, so a control can show it. */
    readonly isRunning: boolean
    /** The words on the control that runs the action. */
    readonly label: string
}

/** The values a block's slots resolve to: a read handle per read slot, an action handle per action slot. */
export type SlotValues<S extends BlockSlots> = {
    readonly [K in keyof S]: S[K] extends BlockReadSlot ? ReadHandle : ActionHandle
}

/** The browsing ports of a block host. */
export interface BlockNavigation {
    /** The address of a path inside the app, for a link. */
    readonly href: (path: string) => string
    /** The value of a key of the route's query; null when absent. */
    readonly queryValue: (key: string) => string | null
    /** Sets a key of the route's query, or removes it with null. */
    readonly setQueryValue: (key: string, value: string | null) => void
}

/** The ports a block may use; the renderer's provider implements them. */
export interface BlockHost {
    /** The translator of one message namespace: a key through the catalogue, inline words in the viewer's language. */
    readonly text: (namespace: string) => (text: SpecText) => string
    /** The language of the viewer. */
    readonly locale: () => SpecLocale
    /** The browsing ports. */
    readonly navigation: BlockNavigation
    /** Tells the viewer the outcome of something they did, in a toast. */
    readonly notify: (tone: "success" | "danger" | "default", message: string) => void
    /** Reports a contract defect (a bound path missing in ready data) instead of drawing a blank block. */
    readonly report: (code: string, at: string) => void
}

/** The typed props of a block, as its zod schema parses them. */
export type BlockPropsOf<P extends PropsSchema> = z.infer<P>
