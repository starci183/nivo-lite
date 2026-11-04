import type {
    ActionHandle,
    ActionOutcome,
    BlockHost,
    ReadHandle,
    ReadVariables,
    SlotValues,
    BlockSlots,
} from "../../block/block.types"
import type { DataSlot, SlotLabels } from "../../slot/slot.types"
import type { HostAction, HostRead, WorkbenchHost } from "../../host/host.types"
import { trusted } from "../../schema/trusted"

/** The slots of each data status a block test draws with. */
export interface SlotStatuses {
    /** A slot still loading its first answer. */
    readonly loading: DataSlot<never>
    /** A slot the viewer may not see. */
    readonly forbidden: DataSlot<never>
    /** A slot whose read failed. */
    readonly error: DataSlot<never>
    /** A slot whose read settled with nothing. */
    readonly empty: DataSlot<never>
    /** A slot settled with the given items. */
    readonly ready: <T>(items: T) => DataSlot<T>
}

/** The data-status slots a block test draws with. */
export const slotOf: SlotStatuses = {
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
    error: { isError: true },
    empty: { isEmpty: true },
    ready: (items) => ({ items }),
}

/** A read handle over a slot, with the retry and variable setters recorded. */
export interface FakeReadHandle extends ReadHandle {
    /** How many times the block asked to read again. */
    readonly retries: () => number
    /** The variable sets the block asked for, in order. */
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
    /** The inputs each run was given, in order. */
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
): SlotValues<S> => trusted<SlotValues<S>>(handles)

/** A block host for a block test: keys come back as themselves, owner words in the locale, notifications and reports recorded. */
export interface FakeBlockHost extends BlockHost {
    /** The notifications the block raised, in order. */
    readonly notices: () => ReadonlyArray<string>
    /** The reports the block made, in order. */
    readonly reports: () => ReadonlyArray<string>
}

/** The locale of a fake block host that was given none. */
const englishLocale = (): "vi" | "en" => "en"

/** The status words of a fake workbench host: each is its own name, beside the empty sentence of the region. */
const labelsOf = (empty: string): SlotLabels => ({ empty, forbidden: "forbidden", error: "error", retry: "retry" })

/** Builds a fake block host; every port may be overridden. */
export const recordingBlockHost = (overrides: Partial<BlockHost> = {}): FakeBlockHost => {
    const notices: Array<string> = []
    const reports: Array<string> = []
    const query = new Map<string, string>()
    const locale = overrides.locale ?? englishLocale
    const wordsOf: ReturnType<BlockHost["text"]> = (text) => ("key" in text ? text.key : text[locale()])
    return {
        text: () => wordsOf,
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
    /** Overrides for the block host ports of the fake. */
    readonly block?: Partial<BlockHost>
}

/** A workbench host for a renderer test. */
export interface FakeWorkbenchHost extends WorkbenchHost {
    /** The fake block host the workbench hands to blocks. */
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
    useSlotLabels: () => labelsOf,
})
