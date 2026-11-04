import type {
    ActionHandle,
    ActionOutcome,
    BlockHost,
    ReadHandle,
    ReadVariables,
    SlotValues,
    BlockSlots,
} from "../block/block.types"
import type { DataSlot } from "../slot/slot.types"
import type { HostAction, HostRead, WorkbenchHost } from "../host/host.types"

/** The data-status slots a block test draws with. */
export const slotOf: {
    readonly loading: DataSlot<never>
    readonly forbidden: DataSlot<never>
    readonly error: DataSlot<never>
    readonly empty: DataSlot<never>
    readonly ready: <T>(items: T) => DataSlot<T>
} = {
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
    error: { isError: true },
    empty: { isEmpty: true },
    ready: (items) => ({ items }),
}

/** A read handle over a slot, with the retry and variable setters recorded. */
export interface FakeReadHandle extends ReadHandle {
    readonly retries: () => number
    readonly variableSets: () => ReadonlyArray<ReadVariables>
}

/** A read handle for a block test: the given slot, counting retries and recording variable changes. */
export const recordingReadHandle = (slot: DataSlot<unknown>, variables: ReadVariables = {}): FakeReadHandle => {
    let retries = 0
    const sets: Array<ReadVariables> = []
    return {
        slot,
        variables,
        page: null,
        retry: () => {
            retries += 1
        },
        setVariables: (next) => {
            sets.push(next)
        },
        retries: () => retries,
        variableSets: () => sets,
    }
}

/** An action handle for a block test, with the inputs it was run with recorded. */
export interface FakeActionHandle extends ActionHandle {
    readonly runs: () => ReadonlyArray<Parameters<ActionHandle["run"]>[0]>
}

/** An action handle for a block test: allowed unless told otherwise, answering every run with `outcome`. */
export const recordingActionHandle = (
    options: { readonly outcome?: ActionOutcome; readonly isAllowed?: boolean; readonly label?: string } = {},
): FakeActionHandle => {
    const runs: Array<Parameters<ActionHandle["run"]>[0]> = []
    return {
        run: (input) => {
            runs.push(input)
            return Promise.resolve(options.outcome ?? { ok: true })
        },
        isAllowed: options.isAllowed ?? true,
        isRunning: false,
        label: options.label ?? "",
        runs: () => runs,
    }
}

/** The slot values of a block test, from read and action handles by slot name. */
export const slotValuesOf = <S extends BlockSlots>(
    handles: Readonly<Record<keyof S, ReadHandle | ActionHandle>>,
): SlotValues<S> => handles as SlotValues<S>

/** A block host for a block test: keys come back as themselves, owner words in the locale, notifications and reports recorded. */
export interface FakeBlockHost extends BlockHost {
    readonly notices: () => ReadonlyArray<string>
    readonly reports: () => ReadonlyArray<string>
}

/** Builds a fake block host; every port may be overridden. */
export const recordingBlockHost = (overrides: Partial<BlockHost> = {}): FakeBlockHost => {
    const notices: Array<string> = []
    const reports: Array<string> = []
    const query = new Map<string, string>()
    const locale = overrides.locale ?? ((): "vi" | "en" => "en")
    return {
        text: () => (text) => ("key" in text ? text.key : text[locale()]),
        locale,
        navigation: {
            href: (path) => path,
            queryValue: (key) => query.get(key) ?? null,
            setQueryValue: (key, value) => {
                if (value === null) query.delete(key)
                else query.set(key, value)
            },
        },
        notify: (_tone, message) => {
            notices.push(message)
        },
        report: (code, at) => {
            reports.push(`${code} @ ${at}`)
        },
        ...overrides,
        notices: () => notices,
        reports: () => reports,
    }
}

/** A host read in a settled state. */
export const settledHostRead = (status: HostRead["status"], data: unknown = undefined): HostRead => ({
    status,
    data,
    isValidating: false,
    reload: () => undefined,
    page: null,
})

/** The ports of a fake workbench host that tests tune. */
export interface FakeWorkbenchOptions {
    /** The read of each operation; loading when absent. */
    readonly reads?: Readonly<Record<string, HostRead>>
    /** The outcome of each action operation; ok when absent. */
    readonly actions?: Readonly<Record<string, ActionOutcome>>
    /** The permissions the viewer holds; all when absent. */
    readonly permissions?: ReadonlyArray<string>
    readonly block?: Partial<BlockHost>
}

/** A workbench host for a renderer test. */
export interface FakeWorkbenchHost extends WorkbenchHost {
    readonly block: FakeBlockHost
}

/** Builds a fake workbench host: reads, actions and permissions from the options, words from the key. */
export const scriptedWorkbenchHost = (options: FakeWorkbenchOptions = {}): FakeWorkbenchHost => ({
    block: recordingBlockHost(options.block),
    useRead: (operation, variables) =>
        variables === null ? settledHostRead("loading") : (options.reads?.[operation] ?? settledHostRead("loading")),
    useAction: (operation): HostAction => ({
        run: () => Promise.resolve(options.actions?.[operation] ?? { ok: true }),
        isRunning: false,
    }),
    useCan: (permission) => permission === null || (options.permissions?.includes(permission) ?? true),
    useSlotLabels: () => (empty) => ({ empty, forbidden: "forbidden", error: "error", retry: "retry" }),
})
