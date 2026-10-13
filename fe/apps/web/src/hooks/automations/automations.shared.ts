import type { AutomationCardView, ModuleScope } from "@/lib/automation-shared"
import type { AutomationStatus, AutomationValues } from "@/modules/automations"
import type { AutomationCommandView, DbOutcome } from "@/modules/db"
import type { AutomationsLanguage, AutomationsTranslator } from "@/modules/types"
import { AUTOMATION_ROUTES } from "@/modules/routes"
import type { AutomationsData } from "./useAutomations"

/** What an owner changes on one pipeline; every field is optional. */
export interface AutomationPatch {
    readonly enabled?: boolean
    readonly dismissed?: boolean
    readonly values?: AutomationValues
    readonly body?: string
    readonly autoSend?: boolean
    readonly googleConnectionId?: string
}

/** The request to change one pipeline. */
export interface ChangeRequest {
    readonly workspaceId: string
    readonly templateKey: string
    readonly patch: AutomationPatch
}

/** The request for a command of the back end. */
export interface CommandRequest {
    readonly workspaceId: string
    readonly kind: "propose_body" | "run_now"
    readonly templateKey: string
}

/** What the board needs to start: the data, the words and the two actions of the database. */
export interface AutomationsBoardInput {
    readonly workspaceId: string
    readonly initial: AutomationsData
    readonly layout: "page" | "module"
    readonly moduleKey?: ModuleScope
    readonly focus?: string
    readonly t: AutomationsTranslator
    readonly locale: AutomationsLanguage
    readonly when: (iso: string) => string
    readonly change: (request: ChangeRequest) => Promise<DbOutcome<AutomationCardView>>
    readonly command: (request: CommandRequest) => Promise<DbOutcome<AutomationCommandView>>
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
