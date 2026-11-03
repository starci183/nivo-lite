import type { z } from "zod"
import type { DataShape, JsonSchema, Namespaced, PropsSchema, SpecLocale, SpecText } from "../schema/schema.types"
import type { DataSlot } from "../slot/slot.types"

/** A read slot of a block: the data a spec binds to it. */
export interface BlockReadSlot {
    readonly kind: "read"
    /** The shape the bound read must have. */
    readonly shape: DataShape
    readonly required: boolean
    /** When set, a bound read must yield this data kind. */
    readonly dataKind?: string
}

/** An action slot of a block: a command a spec binds to it. */
export interface BlockActionSlot {
    readonly kind: "action"
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
    readonly id: Namespaced
    readonly title: SpecText
    /** The literal props a spec may set; every member must convert with `z.toJSONSchema`. */
    readonly props: P
    readonly slots: S
    readonly children: BlockChildren
}

/** A block definition: React-free data and a zod schema. Its component is registered apart, on the client side. */
export interface BlockDefinition<
    P extends PropsSchema = PropsSchema,
    S extends BlockSlots = BlockSlots,
> extends BlockConfig<P, S> {
    readonly entry: "block"
    /** `z.toJSONSchema(props)`, computed once. */
    readonly propsJson: JsonSchema
}

/** What `defineRead` takes: a data source a spec binds a read slot to, run under the VIEWER's session and rights. */
export interface ReadConfig<V extends PropsSchema> {
    readonly id: Namespaced
    readonly dataKind: string
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

/** A read definition. */
export interface ReadDefinition<V extends PropsSchema = PropsSchema> extends ReadConfig<V> {
    readonly entry: "read"
}

/** What `defineAction` takes: a host command run with the bound record's id. */
export interface ActionConfig {
    readonly id: Namespaced
    readonly operation: string
    readonly permission: string
    readonly label: SpecText
}

/** An action definition. */
export interface ActionDefinition extends ActionConfig {
    readonly entry: "action"
}

/** The variables of a read: literals a spec or a block sets. */
export type ReadVariables = Readonly<Record<string, string | number | boolean | null>>

/** Paging of a read: more rows, loaded on request. */
export interface ReadPage {
    readonly hasMore: boolean
    readonly isLoadingMore: boolean
    readonly failure: boolean
    readonly loadMore: () => void
}

/** What a block receives for a read slot: the slot, the way to read it again, its variables and its paging. */
export interface ReadHandle<T = unknown> {
    readonly slot: DataSlot<T>
    readonly retry: () => void
    readonly variables: ReadVariables
    readonly setVariables: (variables: ReadVariables) => void
    readonly page: ReadPage | null
}

/** What running an action yields. */
export type ActionOutcome =
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: "invalid"; readonly fields: Readonly<Record<string, SpecText>> }
    | { readonly ok: false; readonly reason: "forbidden" | "conflict" | "failed"; readonly message: SpecText }

/** What a block hands an action: the record, an optional row command and form values. */
export interface ActionInput {
    readonly id: string
    readonly command?: string
    readonly values?: Readonly<Record<string, string | number | boolean | null>>
}

/** What a block receives for an action slot. */
export interface ActionHandle {
    readonly run: (input: ActionInput) => Promise<ActionOutcome>
    readonly isAllowed: boolean
    readonly isRunning: boolean
    readonly label: string
}

/** The values a block's slots resolve to: a read handle per read slot, an action handle per action slot. */
export type SlotValues<S extends BlockSlots> = {
    readonly [K in keyof S]: S[K] extends BlockReadSlot ? ReadHandle : ActionHandle
}

/** The browsing ports of a block host. */
export interface BlockNavigation {
    readonly href: (path: string) => string
    readonly queryValue: (key: string) => string | null
    readonly setQueryValue: (key: string, value: string | null) => void
}

/** The ports a block may use; the renderer's provider implements them. */
export interface BlockHost {
    /** The translator of one message namespace: a key through the catalogue, inline words in the viewer's language. */
    readonly text: (namespace: string) => (text: SpecText) => string
    readonly locale: () => SpecLocale
    readonly navigation: BlockNavigation
    readonly notify: (tone: "success" | "danger" | "default", message: string) => void
    /** Reports a contract defect (a bound path missing in ready data) instead of drawing a blank block. */
    readonly report: (code: string, at: string) => void
}

/** The typed props of a block, as its zod schema parses them. */
export type BlockPropsOf<P extends PropsSchema> = z.infer<P>
