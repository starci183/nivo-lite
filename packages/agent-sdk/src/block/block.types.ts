import type { z } from "../schema/zod.schema"
import type { DataShape, JsonSchema, Namespaced, PropsSchema, SpecLocale, SpecText } from "../schema/schema.types"
import type { DataSlot } from "../slot/slot.types"

/** A read slot of a block: the data a spec binds to it. */
export interface BlockReadSlot {
    /** Discriminant that tells the binder this slot takes a read. */
    readonly kind: "read"
    /** The shape the bound read must have. */
    readonly shape: DataShape
    /** Whether a spec must bind a read here; an unbound required slot is a spec problem. */
    readonly required: boolean
    /** When set, a bound read must yield this data kind. */
    readonly dataKind?: string
}

/** An action slot of a block: a command a spec binds to it. */
export interface BlockActionSlot {
    /** Discriminant that tells the binder this slot takes an action. */
    readonly kind: "action"
    /** Whether a spec must bind an action here; an unbound required slot is a spec problem. */
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
    /** The namespaced id specs use to place this block. */
    readonly id: Namespaced
    /** The words the editor shows for the block in its palette. */
    readonly title: SpecText
    /** The literal props a spec may set; every member must convert with `z.toJSONSchema`. */
    readonly props: P
    /** The named read and action slots a spec may bind; the component receives one handle per slot. */
    readonly slots: S
    /** Whether the block nests child blocks and, if so, how many and of which ids. */
    readonly children: BlockChildren
}

/** A block definition: React-free data and a zod schema. Its component is registered apart, on the client side. */
export interface BlockDefinition<
    P extends PropsSchema = PropsSchema,
    S extends BlockSlots = BlockSlots,
> extends BlockConfig<P, S> {
    /** Tag that tells a registry this definition is a block. */
    readonly entry: "block"
    /** `z.toJSONSchema(props)`, computed once. */
    readonly propsJson: JsonSchema
}

/** What `defineRead` takes: a data source a spec binds a read slot to, run under the VIEWER's session and rights. */
export interface ReadConfig<V extends PropsSchema> {
    /** The namespaced id a spec names when it binds a read slot to this source. */
    readonly id: Namespaced
    /** The data kind the read yields; a slot that requires a kind accepts only reads of it. */
    readonly dataKind: string
    /** Whether the read yields one record or a list of records. */
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

/** A read as registered: the config plus the tag a registry sorts on. */
export interface ReadDefinition<V extends PropsSchema = PropsSchema> extends ReadConfig<V> {
    /** Tag that tells a registry this definition is a read. */
    readonly entry: "read"
}

/** What `defineAction` takes: a host command run with the bound record's id. */
export interface ActionConfig {
    /** The namespaced id a spec names when it binds an action slot to this command. */
    readonly id: Namespaced
    /** The host operation the action runs, which must be on the host allowlist. */
    readonly operation: string
    /** The member permission a viewer needs before the action is allowed to run. */
    readonly permission: string
    /** The words shown on the control that runs the action. */
    readonly label: SpecText
}

/** An action as registered: the config plus the tag a registry sorts on. */
export interface ActionDefinition extends ActionConfig {
    /** Tag that tells a registry this definition is an action. */
    readonly entry: "action"
}

/** The variables of a read: literals a spec or a block sets. */
export type ReadVariables = Readonly<Record<string, string | number | boolean | null>>

/** Paging of a read: more rows, loaded on request. */
export interface ReadPage {
    /** True while the source holds rows beyond the ones loaded so far. */
    readonly hasMore: boolean
    /** True while a further page is being fetched, so a block can show a spinner. */
    readonly isLoadingMore: boolean
    /** True when the last attempt to load a further page failed. */
    readonly failure: boolean
    /** Fetches the next page and appends it to the slot data. */
    readonly loadMore: () => void
}

/** What a block receives for a read slot: the slot, the way to read it again, its variables and its paging. */
export interface ReadHandle<T = unknown> {
    /** The loading, ready or failed state of the data, which the block draws. */
    readonly slot: DataSlot<T>
    /** Reads the source again after a failure, replacing the slot state. */
    readonly retry: () => void
    /** The variables the read currently runs with. */
    readonly variables: ReadVariables
    /** Replaces the variables and so triggers a fresh read, for filters and search boxes. */
    readonly setVariables: (variables: ReadVariables) => void
    /** Paging of the read, or null when the source is not paged. */
    readonly page: ReadPage | null
}

/** What running an action yields. */
export type ActionOutcome =
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: "invalid"; readonly fields: Readonly<Record<string, SpecText>> }
    | { readonly ok: false; readonly reason: "forbidden" | "conflict" | "failed"; readonly message: SpecText }

/** What a block hands an action: the record, an optional row command and form values. */
export interface ActionInput {
    /** The id of the record the action is run on. */
    readonly id: string
    /** A row-level command name when the action offers several; absent otherwise. */
    readonly command?: string
    /** Form values to send along with the command; absent when the action takes none. */
    readonly values?: Readonly<Record<string, string | number | boolean | null>>
}

/** What a block receives for an action slot. */
export interface ActionHandle {
    /** Runs the action under the viewer rights and answers its outcome; it never throws. */
    readonly run: (input: ActionInput) => Promise<ActionOutcome>
    /** False when the viewer lacks the permission, so a block hides or disables the control. */
    readonly isAllowed: boolean
    /** True while a run is in flight, so a block can prevent a second click. */
    readonly isRunning: boolean
    /** The words, already translated, to show on the control that runs the action. */
    readonly label: string
}

/** The values a block's slots resolve to: a read handle per read slot, an action handle per action slot. */
export type SlotValues<S extends BlockSlots> = {
    readonly [K in keyof S]: S[K] extends BlockReadSlot ? ReadHandle : ActionHandle
}

/** The browsing ports of a block host. */
export interface BlockNavigation {
    /** Turns an app path into the link address the host routes, so a block never builds URLs itself. */
    readonly href: (path: string) => string
    /** Reads one query-string value of the current page, or null when absent. */
    readonly queryValue: (key: string) => string | null
    /** Writes or clears (null) one query-string value, which navigates the current page in place. */
    readonly setQueryValue: (key: string, value: string | null) => void
}

/** The ports a block may use; the renderer's provider implements them. */
export interface BlockHost {
    /** The translator of one message namespace: a key through the catalogue, inline words in the viewer's language. */
    readonly text: (namespace: string) => (text: SpecText) => string
    /** Answers the viewer language at the time of the call. */
    readonly locale: () => SpecLocale
    /** The browsing ports a block uses to link and to keep state in the address. */
    readonly navigation: BlockNavigation
    /** Shows a short toast to the viewer in the given tone. */
    readonly notify: (tone: "success" | "danger" | "default", message: string) => void
    /** Reports a contract defect (a bound path missing in ready data) instead of drawing a blank block. */
    readonly report: (code: string, at: string) => void
}

/** The typed props of a block, as its zod schema parses them. */
export type BlockPropsOf<P extends PropsSchema> = z.infer<P>
