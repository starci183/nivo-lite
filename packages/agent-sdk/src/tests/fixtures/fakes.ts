import type {
    ActionHandle,
    ActionOutcome,
    BlockHost,
    ReadHandle,
    ReadVariables,
    SlotValues,
    BlockSlots,
} from "../../block/block.types"
import type { SpecLocale, SpecText } from "../../schema/schema.types"
import type { DataSlot, SlotLabels } from "../../slot/slot.types"
import type { HostAction, HostRead, WorkbenchHost } from "../../host/host.types"

/** The data-status slots a block test draws with. */
interface SlotFixtures {
    /** A read that is running. */
    readonly loading: DataSlot<never>
    /** A read the viewer may not see. */
    readonly forbidden: DataSlot<never>
    /** A read that failed. */
    readonly error: DataSlot<never>
    /** A read that settled with nothing to draw. */
    readonly empty: DataSlot<never>
    /** A read that settled with the given items. */
    readonly ready: <T>(items: T) => DataSlot<T>
}

/** The data-status slots a block test draws with. */
export const slotOf: SlotFixtures = {
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
    error: { isError: true },
    empty: { isEmpty: true },
    ready: (items) => ({ items }),
}

/** A read handle over a slot, with the retry and variable setters recorded. */
export interface SampleReadHandle extends ReadHandle {
    /** How many times the block asked to read again. */
    readonly retries: () => number
    /** The variables the block asked to read with, in order. */
    readonly variableSets: () => ReadonlyArray<ReadVariables>
}

/** A read handle for a block test: the given slot, counting retries and recording variable changes. */
export const sampleReadHandle = (slot: DataSlot<unknown>, variables: ReadVariables = {}): SampleReadHandle => {
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
export interface SampleActionHandle extends ActionHandle {
    /** The inputs the block ran the action with, in order. */
    readonly runs: () => ReadonlyArray<Parameters<ActionHandle["run"]>[0]>
}

/** An action handle for a block test: allowed unless told otherwise, answering every run with `outcome`. */
export const sampleActionHandle = (
    options: { readonly outcome?: ActionOutcome; readonly isAllowed?: boolean; readonly label?: string } = {},
): SampleActionHandle => {
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
export function sampleSlots<S extends BlockSlots>(
    handles: Readonly<Record<keyof S, ReadHandle | ActionHandle>>,
): SlotValues<S>
/** The handles as they come: the signature above types them by the slots of the block, which a double cannot check at run time. */
export function sampleSlots(
    handles: Readonly<Record<string, ReadHandle | ActionHandle>>,
): Readonly<Record<string, ReadHandle | ActionHandle>> {
    return handles
}

/** A block host for a block test: keys come back as themselves, owner words in the locale, notifications and reports recorded. */
export interface SampleBlockHost extends BlockHost {
    /** The messages the block notified, in order. */
    readonly notices: () => ReadonlyArray<string>
    /** The contract defects the block reported, as `<code> @ <at>`, in order. */
    readonly reports: () => ReadonlyArray<string>
}

/** The language of a block host that is not told another. */
const englishLocale = (): SpecLocale => "en"

/** Builds a sample block host; every port may be overridden. */
export const sampleBlockHost = (overrides: Partial<BlockHost> = {}): SampleBlockHost => {
    const notices: Array<string> = []
    const reports: Array<string> = []
    const query = new Map<string, string>()
    const locale = overrides.locale ?? englishLocale
    const translate = (text: SpecText): string => ("key" in text ? text.key : text[locale()])
    return {
        text: () => translate,
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
export const sampleHostRead = (status: HostRead["status"], data: unknown = undefined): HostRead => ({
    status,
    data,
    isValidating: false,
    reload: () => undefined,
    page: null,
})

/** The ports of a sample workbench host that tests tune. */
export interface SampleWorkbenchOptions {
    /** The read of each operation; loading when absent. */
    readonly reads?: Readonly<Record<string, HostRead>>
    /** The outcome of each action operation; ok when absent. */
    readonly actions?: Readonly<Record<string, ActionOutcome>>
    /** The permissions the viewer holds; all when absent. */
    readonly permissions?: ReadonlyArray<string>
    /** The ports of the block host to override. */
    readonly block?: Partial<BlockHost>
}

/** A workbench host for a renderer test. */
export interface SampleWorkbenchHost extends WorkbenchHost {
    /** The block host, with its notices and reports readable. */
    readonly block: SampleBlockHost
}

/** The words of the data-status recipe of a host read in a test: the empty sentence of one region, and each status named. */
const slotLabelsOf = (empty: string): SlotLabels => ({ empty, forbidden: "forbidden", error: "error", retry: "retry" })

/** Builds a sample workbench host: reads, actions and permissions from the options, words from the key. */
export const sampleWorkbenchHost = (options: SampleWorkbenchOptions = {}): SampleWorkbenchHost => ({
    block: sampleBlockHost(options.block),
    useRead: (operation, variables) =>
        variables === null ? sampleHostRead("loading") : (options.reads?.[operation] ?? sampleHostRead("loading")),
    useAction: (operation): HostAction => ({
        run: () => Promise.resolve(options.actions?.[operation] ?? { ok: true }),
        isRunning: false,
    }),
    useCan: (permission) => permission === null || (options.permissions?.includes(permission) ?? true),
    useSlotLabels: () => slotLabelsOf,
})
