import type { automationBoardOf, AutomationStatus, AutomationValues } from "@/modules/automations"
import { AUTOMATION_ROUTES } from "@/modules/routes"
import type {
    AutomationCardView,
    AutomationRunView,
    AutomationsLanguage,
    AutomationsTranslator,
    GoogleAccount,
    PreviewSample,
    ShopContext,
} from "@/modules/types"
import type { useAutomationDetail } from "./useAutomationDetail"

/** What the board shows, as the back end answers it. */
export interface AutomationsData {
    readonly cards: ReadonlyArray<AutomationCardView>
    readonly runs: ReadonlyArray<AutomationRunView>
    readonly shop: ShopContext
    /** The sample values and neutral words of the message previews. */
    readonly sample: PreviewSample
    /** The Google accounts a spreadsheet automation can write with. */
    readonly accounts: ReadonlyArray<GoogleAccount>
}

/** What an owner changes on one pipeline; every field is optional. */
export interface AutomationPatch {
    readonly enabled?: boolean
    readonly dismissed?: boolean
    readonly values?: AutomationValues
    readonly body?: string
    readonly autoSend?: boolean
    readonly googleConnectionId?: string
}

/** What the board needs: the words, the scope and how it is embedded. */
export interface AutomationsBoardInput {
    readonly layout: "page" | "module"
    readonly moduleKey?: string
    readonly focus?: string
    readonly t: AutomationsTranslator
    readonly locale: AutomationsLanguage
    readonly when: (iso: string) => string
}

/** The pages a connection that is missing sends the owner to. */
export const CONNECTION_ROUTE: Readonly<Partial<Record<AutomationStatus, string>>> = {
    needsWebhook: AUTOMATION_ROUTES.developers,
    needsEmail: AUTOMATION_ROUTES.connectEmail,
}

/** What the owner can do on the board, drawn as buttons and switches. */
export interface AutomationsBoardActions {
    readonly select: (key: string) => void
    readonly toggle: (key: string, next: boolean) => void
    readonly setFilter: (id: string) => void
    readonly close: () => void
    readonly dismissError: () => void
    readonly restore: (key: string) => void
    readonly pickAccount: (key: string, connectionId: string) => void
    readonly dismiss: () => void
    readonly changeSetting: (key: string, value: string | number | boolean) => void
    readonly saveSettings: () => void
    readonly changeBody: (value: string) => void
    readonly enable: () => void
    readonly saveBody: () => void
    readonly compose: () => void
    readonly answerTrust: (accept: boolean) => void
    readonly runNow: () => void
}
/** The resolved inputs for automation board view input. */
interface AutomationBoardViewInput {
    readonly t: AutomationsTranslator
    readonly locale: AutomationsLanguage
    readonly moduleNames: ModuleNamesInput1
    readonly input: AutomationsBoardInput
    readonly isNested: boolean
    readonly cards: readonly AutomationCardView[]
    readonly scoped: AutomationCardView[]
    readonly shown: AutomationCardView[]
    readonly filter: string
    readonly selected: string | null
    readonly data: AutomationsData
    readonly busyKey: string | null
    readonly current: AutomationCardView | null
    readonly detail: ReturnType<typeof useAutomationDetail>
    readonly awaiting: string | null
}

/** Collects loaded board data and the open editor into the automation display input. */
export const automationBoardInputOf = ({
    t,
    locale,
    moduleNames,
    input,
    isNested,
    cards,
    scoped,
    shown,
    filter,
    selected,
    data,
    busyKey,
    current,
    detail,
    awaiting,
}: AutomationBoardViewInput): Parameters<typeof automationBoardOf>[0] => {
    return {
        t,
        locale,
        moduleNames,
        when: input.when,
        isNested,
        cards,
        scoped,
        shown,
        filter,
        selected,
        busyKey,
        accounts: data.accounts,
        runs: data.runs,
        shop: data.shop,
        sample: data.sample,
        current,
        errorText: undefined,
        open: {
            values: detail.form.values,
            body: detail.form.body,
            note: detail.form.note,
            isComposing: detail.work.isComposing,
            isStarting: detail.work.isStarting,
            isStarted: detail.work.isStarted,
            isSaved: detail.form.isSaved,
            isAwaiting: current !== null && awaiting === current.key && current.body === null,
        },
    }
}

type ModuleNamesInput1 = { [k: string]: string }
/** The resolved inputs for automation board actions input. */
interface AutomationBoardActionsInput {
    readonly select: AutomationsBoardActions["select"]
    readonly toggle: AutomationsBoardActions["toggle"]
    readonly filters: ReadonlyArray<string>
    readonly setFilter: (value: string) => void
    readonly setSelected: (value: string | null) => void
    readonly change: (key: string, patch: AutomationPatch) => Promise<boolean>
    readonly current: AutomationCardView | null
    readonly detail: ReturnType<typeof useAutomationDetail>
    readonly saveSettings: () => Promise<void>
    readonly saveBody: () => Promise<boolean>
    readonly enable: () => Promise<void>
}

/** Connects board controls to selection, editing and pipeline changes. */
export const automationBoardActionsOf = ({
    select,
    toggle,
    filters,
    setFilter,
    setSelected,
    change,
    current,
    detail,
    saveSettings,
    saveBody,
    enable,
}: AutomationBoardActionsInput): AutomationsBoardActions => ({
    select,
    toggle,
    setFilter: (id) => {
        const next = filters.find((key) => key === id)
        if (next !== undefined) setFilter(next)
    },
    close: () => setSelected(null),
    dismissError: () => undefined,
    restore: (key) => void change(key, { dismissed: false }),
    pickAccount: (key, connectionId) => void change(key, { googleConnectionId: connectionId }),
    dismiss: () => {
        if (current !== null) void change(current.key, { dismissed: true }).then((ok) => ok && setSelected(null))
    },
    changeSetting: detail.changeValue,
    saveSettings: () => void saveSettings(),
    changeBody: detail.editBody,
    enable: () => void enable(),
    saveBody: () => void saveBody(),
    compose: () => detail.compose(),
    answerTrust: (accept) => {
        if (current !== null) void change(current.key, { autoSend: accept })
    },
    runNow: detail.startRun,
})
