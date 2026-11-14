import type { z } from "zod"
import type {
    DataShape,
    JsonSchema,
    JsonValue,
    Namespaced,
    PropsSchema,
    SpecLocale,
    SpecText,
} from "../schema/schema.types"
import type { PortMap, PortProvider, PortsOf, RunContext } from "../port/port.types"
import type { FileRef } from "../entity/file-ref"
import type { DataSlot } from "../slot/slot.types"
import type { ReadListing } from "./list.types"

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
    /**
     * The names of the props whose string value names a spec param (`searchParam`, `selectParam`; a dotted name reaches into an
     * object prop, `sort.param`); a spec is refused when one names no param.
     */
    readonly params?: ReadonlyArray<string>
    /**
     * The name of the prop whose string value is a record type the block's slots reach (a file block's `type`): every read and action a
     * spec binds to a slot of the block must declare that type's entity port, or the spec is refused (`SPEC_BINDING_ENTITY`). The door
     * grants the block's file calls by exactly that declaration.
     */
    readonly reaches?: string
    /**
     * How the block stands in a view: `cards` (default) floats it in the pink well; `panes` is a grid of its own panes (a master-detail inbox), which takes the whole main
     * pane full-bleed, flush with the chrome, and scrolls inside each pane.
     */
    readonly layout?: "cards" | "panes"
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

/** Why a raw value was refused as the variables of a read or the input of an action. */
export interface InputProblem {
    /** `INPUT_INVALID`: a value the schema refuses; `INPUT_UNKNOWN_KEY`: a key the schema does not declare. */
    readonly code: "INPUT_INVALID" | "INPUT_UNKNOWN_KEY"
    /** The dotted path of the value or key, `.` for the whole. */
    readonly at: string
}

/** How running a read ended: its data, or the problems of the variables it was given. */
export type ReadRunResult<R = unknown> =
    { readonly ok: true; readonly data: R } | { readonly ok: false; readonly problems: ReadonlyArray<InputProblem> }

/**
 * What `defineRead` takes for a read that RUNS in the package, against typed data ports: the back end implements the ports and
 * the one generic door calls `execute`; the graph nodes call the same code, so the screen and the agent never differ.
 */
export interface RunReadConfig<V extends PropsSchema, P extends PortMap, R> {
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
    /** The variables a spec may set and the door accepts; an unknown key is refused. */
    readonly variables: V
    /** The member permission a viewer needs. */
    readonly permission: string
    /** The ports the read needs, by the name `run` reaches them by. */
    readonly ports: P
    /** The read itself: pure business over the ports. */
    readonly run: (ports: PortsOf<P>, variables: z.infer<V>, context: RunContext) => Promise<R>
}

/** A registered read, as the registry holds it after `defineRead` checked it. */
export interface ReadDefinition<V extends PropsSchema = PropsSchema> extends ReadConfig<V> {
    /** Tells a read from a block or an action in the registry. */
    readonly entry: "read"
    /** The ports of a read that runs in the package; absent on a host-operation read. */
    readonly ports?: PortMap | undefined
    /**
     * Runs a read that runs in the package: parses `raw` against `variables` (an unknown key is refused), builds the ports from
     * the provider and calls the read's `run`. Absent on a host-operation read. The renderer never calls it.
     */
    readonly execute?:
        ((provider: PortProvider, raw: unknown, context: RunContext) => Promise<ReadRunResult>) | undefined
    /** Set by `listRead` and `countsRead`: what the read lists or counts. */
    readonly listing?: ReadListing | undefined
}

/** What `defineAction` takes: a host command run with the bound record's id. */
export interface ActionConfig {
    /** The registry id a spec binds the action by; unique across every package. */
    readonly id: Namespaced
    /** The host operation name, on the host's allowlist. */
    readonly operation: string
    /** The member permission a viewer needs to run the action. */
    readonly permission: string
    /**
     * Set to `true` when a staff member may run the action: by default only an owner or a manager runs an action (every member may
     * VIEW every read). The mark is the module's own statement; no action carries it unless its module says so.
     */
    readonly staff?: true
    /** The words on the control that runs the action. */
    readonly label: SpecText
}

/** What running an action in the package yields. */
export type ActionResult =
    | { readonly ok: true; readonly data?: JsonValue }
    | {
          readonly ok: false
          readonly reason: "invalid"
          readonly message: SpecText
          /** The words for each form field the values broke. */
          readonly fields?: Readonly<Record<string, SpecText>>
          readonly data?: JsonValue
      }
    | {
          readonly ok: false
          /** `refused` carries a domain refusal as data (a taken time with the nearest free ones). */
          readonly reason: "forbidden" | "conflict" | "refused" | "failed"
          readonly message: SpecText
          readonly data?: JsonValue
      }

/**
 * What `defineAction` takes for an action that RUNS in the package, against typed data ports (see `RunReadConfig`). The payload
 * the door receives is flat: the `values` of the `ActionInput` with `id` (and `command` when given) merged in.
 */
export interface RunActionConfig<I extends PropsSchema, P extends PortMap> {
    /** The registry id a spec binds the action by; unique across every package. */
    readonly id: Namespaced
    /** The member permission a viewer needs to run the action. */
    readonly permission: string
    /**
     * Set to `true` when a staff member may run the action: by default only an owner or a manager runs an action (every member may
     * VIEW every read). The mark is the module's own statement; no action carries it unless its module says so.
     */
    readonly staff?: true
    /** The words on the control that runs the action. */
    readonly label: SpecText
    /** The payload the door accepts; an unknown key is refused. */
    readonly input: I
    /** The ports the action needs, by the name `run` reaches them by. */
    readonly ports: P
    /** The action itself: pure business over the ports. */
    readonly run: (ports: PortsOf<P>, input: z.infer<I>, context: RunContext) => Promise<ActionResult>
    /** Whether the provider opens one transaction for the run. */
    readonly transactional?: boolean
    /** The reads the front end fetches again when the action succeeds. */
    readonly refreshes: ReadonlyArray<Namespaced>
    /** Whether the front end shows the effect before the answer and takes it back on a refusal. */
    readonly optimistic?: boolean
}

/** A registered action, as the registry holds it after `defineAction` checked it. */
export interface ActionDefinition extends ActionConfig {
    /** Tells an action from a block or a read in the registry. */
    readonly entry: "action"
    /** The payload schema of an action that runs in the package; absent on a host-operation action. */
    readonly input?: PropsSchema | undefined
    /** The ports of an action that runs in the package; absent on a host-operation action. */
    readonly ports?: PortMap | undefined
    /**
     * Runs an action that runs in the package: parses `raw` against `input` (an unknown key is refused as `invalid`), builds the
     * ports from the provider and calls the action's `run`. Absent on a host-operation action. The renderer never calls it.
     */
    readonly execute?:
        ((provider: PortProvider, raw: unknown, context: RunContext) => Promise<ActionResult>) | undefined
    /** Whether the provider opens one transaction for the run; absent means no. */
    readonly transactional?: boolean | undefined
    /** The reads the front end fetches again when the action succeeds; absent means none. */
    readonly refreshes?: ReadonlyArray<Namespaced> | undefined
    /** Whether the front end shows the effect before the answer; absent means no. */
    readonly optimistic?: boolean | undefined
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
    | { readonly ok: true; readonly data?: JsonValue }
    | {
          readonly ok: false
          readonly reason: "invalid"
          readonly fields: Readonly<Record<string, SpecText>>
          readonly message?: SpecText
          readonly data?: JsonValue
      }
    | {
          readonly ok: false
          /** `refused` is a domain refusal; its `data` says what to offer instead. */
          readonly reason: "forbidden" | "conflict" | "refused" | "failed"
          readonly message: SpecText
          readonly data?: JsonValue
      }

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
    /** The address of a path inside the app, for a link; a path that starts with `./` is a sibling page of the one that is open. */
    readonly href: (path: string) => string
    /** The value of a key of the route's query; null when absent. */
    readonly queryValue: (key: string) => string | null
    /** Sets a key of the route's query, or removes it with null. */
    readonly setQueryValue: (key: string, value: string | null) => void
    /**
     * Sets several keys of the route's query in one step (replace, no scroll), or removes a key with null. A write that changes more
     * than one key (a new search and the cursor reset) uses this, because two `setQueryValue` calls in a row would each start from
     * the query as it was and the second would undo the first.
     */
    readonly setQueryValues: (entries: Readonly<Record<string, string | null>>) => void
}

/** The spec params of the drawn spec, by param name (not URL key): the URL is the single source of truth of what the screen shows. */
export interface ParamHandle {
    /** The URL value of the param when it allows it, else its default, else null. */
    readonly value: (name: string) => string | null
    /** Writes the URL key of the param (replace, no scroll); null removes it. It also resets the `cursor` param when the spec has one. */
    readonly set: (name: string, value: string | null) => void
    /**
     * Writes several params in one step, by param name (null removes one), and resets the `cursor` param like `set`. A change that
     * moves more than one param (a tab that chooses a status and clears a period) uses this: two `set` calls in a row would each start
     * from the query as it was.
     */
    readonly setMany: (entries: Readonly<Record<string, string | null>>) => void
}

/** What a block may ask while a file goes up. */
export interface FileUploadOptions {
    /** Called with the share of the bytes sent so far, from 0 to 1, while the bytes go to the store. */
    readonly onProgress?: (share: number) => void
}

/** A short-lived address that reads one stored file. */
export interface SignedFileUrl {
    /** The signed address; it stops working at `expiresAt`, so a block asks again instead of keeping it. */
    readonly url: string
    /** The moment the address stops working, an ISO 8601 instant. */
    readonly expiresAt: string
}

/**
 * The file store as a block reaches it: one file of one record field, named by the record type, the record and the field (the
 * store's key law ties the object to exactly those). A host answers a refusal (a type or size the field does not accept, a record
 * the viewer may not change, a store that is down) by rejecting; the block words it, never the port.
 */
export interface BlockFiles {
    /**
     * Puts `file` on the field of the record and returns the reference the record now holds: asks the store for an upload ticket,
     * sends the bytes to it, confirms the upload (the store checks size and type against the field's declaration) and links the
     * confirmed object to the field. A single field takes it in place of the file it held; a list field (`field.file({ many: true })`)
     * appends it while it holds fewer than its maximum, and rejects when it is full.
     */
    readonly upload: (
        recordType: string,
        recordId: string,
        field: string,
        file: File,
        options?: FileUploadOptions,
    ) => Promise<FileRef>
    /**
     * A short-lived signed address that reads the file now on the field. A list field names the file by its object key (`FileRef.key`),
     * which is required for it; a single field takes no key.
     */
    readonly url: (recordType: string, recordId: string, field: string, key?: string) => Promise<SignedFileUrl>
    /**
     * Removes the file from the field and deletes its object. A list field removes the one file `key` names (required for it) and keeps
     * the others in their order; a single field takes no key.
     */
    readonly remove: (recordType: string, recordId: string, field: string, key?: string) => Promise<void>
}

/**
 * The file store as a HOST implements it: the calls of {@link BlockFiles}, each made for the read or action (`via`, a registry id) whose
 * permission and entity ports grant it. A block never sees `via`: the renderer closes the store over the bindings of the block's own
 * node (`filesVia`).
 */
export interface BlockFileStore {
    /** `BlockFiles.upload`, for the action `via`. */
    readonly upload: (
        via: string,
        recordType: string,
        recordId: string,
        field: string,
        file: File,
        options?: FileUploadOptions,
    ) => Promise<FileRef>
    /** `BlockFiles.url`, for the read or action `via`. */
    readonly url: (via: string, recordType: string, recordId: string, field: string, key?: string) => Promise<SignedFileUrl>
    /** `BlockFiles.remove`, for the action `via`. */
    readonly remove: (via: string, recordType: string, recordId: string, field: string, key?: string) => Promise<void>
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
    /**
     * The file store, as the host implements it (the calls carry the `via` of the node that makes them). Absent on a host with no
     * store behind it (a prototype over fixtures); a block that needs it then reports `BLOCK_FILES_MISSING` and draws no control that
     * would do nothing. A block reaches it through `useNodeFiles`, as {@link BlockFiles}.
     */
    readonly files?: BlockFileStore
}

/** The typed props of a block, as its zod schema parses them. */
export type BlockPropsOf<P extends PropsSchema> = z.infer<P>
