/** The translator of the automations messages. */
export type AutomationsTranslator = (key: string, values?: Record<string, string | number>) => string

/** The reader language of the product. */
export type AutomationsLanguage = "vi" | "en"

/** The tone of a badge. */
export type AutomationTone = "success" | "neutral" | "warning" | "danger"

/** The icon word of a template. */
export type AutomationIconWord =
    | "payment"
    | "leads"
    | "report"
    | "review"
    | "debt"
    | "winback"
    | "moon"
    | "sheet"
    | "calendar"
    | "cart"
    | "contract"
    | "truck"
    | "receipt"
    | "ledger"

/** The Google accounts picker of a card that writes a spreadsheet. */
export interface AccountsView {
    readonly label: string
    readonly description: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string; readonly isDisabled: boolean }>
    readonly value: string | null
    readonly isPending: boolean
}

/** One card, every word already in the reader language. */
export interface CardView {
    readonly dataKey: string
    readonly name: string
    readonly description: string
    readonly triggerLine: string
    readonly statusLabel: string
    readonly statusTone: AutomationTone
    readonly icon: AutomationIconWord
    readonly note?: { readonly text: string; readonly link?: { readonly href: string; readonly label: string } }
    readonly sheet?: { readonly href: string; readonly label: string }
    readonly selectLabel: string
    readonly switchLabel: string
    readonly switchName: string
    readonly isSelected: boolean
    readonly isEnabled: boolean
    readonly isSwitchDisabled: boolean
    readonly accounts?: AccountsView
}

/** One setting of a template as the form edits it. */
export type SettingFieldView = {
    readonly key: string
    readonly id: string
    readonly label: string
    readonly description?: string
} & (
    | { readonly kind: "number"; readonly min: number; readonly max: number; readonly value: number }
    | { readonly kind: "time"; readonly hour: number; readonly minute: number }
    | { readonly kind: "toggle"; readonly isOn: boolean }
    | { readonly kind: "text"; readonly maxLength?: number; readonly value: string }
)

/** The message section, every word already in the reader language. */
export interface MessageView {
    readonly sectionLabel: string
    readonly title: string
    readonly help: string
    readonly staleAlert?: { readonly title: string; readonly body: string; readonly actionLabel: string }
    readonly bodyId: string
    readonly bodyLabel: string
    readonly bodyValue: string
    readonly maxLength: number
    readonly note?: string
    readonly variablesTitle: string
    readonly variables: ReadonlyArray<string>
    readonly enableLabel?: string
    readonly saveLabel: string
    readonly composeLabel: string
    readonly previewTitle: string
    readonly previewText: string
    readonly toneNote?: string
    readonly isBusy: boolean
    readonly isComposing: boolean
    readonly canEnable: boolean
    readonly canSave: boolean
    readonly isFirstApproval: boolean
}

/** The gate section: what happens to the message, how it is written, what NIVO always keeps. */
export interface GateView {
    readonly sectionLabel: string
    readonly authority?: {
        readonly title: string
        readonly gateLine?: string
        readonly alwaysAskLine?: string
        readonly autoSendLine?: string
    }
    readonly modeLine?: string
    readonly trust?: { readonly title: string; readonly yesLabel: string; readonly noLabel: string }
    readonly guardrails?: { readonly title: string; readonly items: ReadonlyArray<string> }
}

/** One run of an automation. */
export interface RunRowView {
    readonly id: string
    readonly statusLabel: string
    readonly tone: AutomationTone
    readonly whenText: string
    readonly summary: string
    readonly decisionsHref?: string
    readonly errorText?: string
    readonly message?: string
    readonly evidence?: string
}

/** The detail of the open card. */
export interface DetailView {
    readonly frame: {
        readonly name: string
        readonly description: string
        readonly closeLabel: string
        readonly dismissLabel: string
        readonly awaitingText?: string
        readonly errorText?: string
        readonly isBusy: boolean
        readonly isNested: boolean
    }
    readonly runNow?: { readonly label: string; readonly isPending: boolean; readonly startedText?: string }
    readonly settings: {
        readonly sectionLabel: string
        readonly fields: ReadonlyArray<SettingFieldView>
        readonly saveLabel: string
        readonly savedText?: string
        readonly isBusy: boolean
    }
    readonly message?: MessageView
    readonly gate?: GateView
    readonly runs: {
        readonly title: string
        readonly emptyText: string
        readonly decisionsLabel: string
        readonly moreLabel: string
        readonly messageLabel: string
        readonly evidenceLabel: string
        readonly rows: ReadonlyArray<RunRowView>
    }
}

/** The whole board as it is drawn. */
export interface AutomationsBoardView {
    readonly filters: {
        readonly label: string
        readonly items: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly selectedId: string
    }
    readonly errorAlert?: { readonly title: string; readonly dismissLabel: string }
    readonly emptyText?: string
    readonly cards: ReadonlyArray<CardView>
    readonly detail?: DetailView
    readonly hidden: {
        readonly title: string
        readonly restoreLabel: string
        readonly items: ReadonlyArray<{ readonly key: string; readonly name: string; readonly isBusy: boolean }>
    }
}
