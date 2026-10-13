import type { AutomationStatus, AutomationValues } from "@/modules/automations"
import { AUTOMATION_ROUTES } from "@/modules/routes"
import type {
    AutomationCardView,
    AutomationRunView,
    AutomationsLanguage,
    AutomationsTranslator,
    GoogleAccount,
    ModuleScope,
    PreviewSample,
    ShopContext,
} from "@/modules/types"

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
    readonly moduleKey?: ModuleScope
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
