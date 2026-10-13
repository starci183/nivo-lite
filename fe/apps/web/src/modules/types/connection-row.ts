/** A result line under a row: what a command answered. */
export interface RowNote {
    readonly tone: "affirmative" | "negative" | "informative"
    readonly text: string
}

/** The one visible action of a row (the one its state calls for). */
export interface RowPrimary {
    readonly id: "continue" | "reconnectGoogle" | "check" | "sync" | "sendTest"
    readonly label: string
    readonly variant: "secondary" | "outline"
    readonly isPending: boolean
}

/** One command of a row's menu; destructive ones carry the negative tone. */
export interface RowMenuItem {
    readonly id: string
    readonly label: string
    readonly tone?: "negative"
}

/** One section of a row's menu. */
export interface RowMenuSection {
    readonly id: string
    readonly items: ReadonlyArray<RowMenuItem>
}

/** An alert inside a row (a missing agent, the last error). */
export interface RowAlert {
    readonly id: string
    readonly tone: "cautionary" | "negative"
    readonly title: string
    readonly description: string
}

/** A confirmation dialog of a destructive command. */
export interface RowDialog {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
}

/** The SePay URL and key a row reveals, with the words of the two fields. */
export interface RowKeys {
    readonly urlLabel: string
    readonly url: string
    readonly keyLabel: string
    readonly key: string
}

/** The words of the in-field copy actions. */
export interface RowCopyLabels {
    readonly copy: string
    readonly copied: string
    readonly reveal: string
    readonly hide: string
}

/** One access level offered to an agent. */
export interface AccessOptionView {
    readonly value: string
    readonly label: string
    readonly description?: string
}

/** One agent in a row's access picker. */
export interface AccessAgentView {
    readonly id: string
    readonly name: string
    readonly isUsable: boolean
    readonly current: string
    readonly options: ReadonlyArray<AccessOptionView>
}

/** A row's agent access picker (or its read-only summary). */
export interface AccessView {
    readonly isEditable: boolean
    readonly summary: string
    readonly triggerLabel: string
    readonly isPending: boolean
    readonly emptyLabel: string
    readonly unusableLabel: string
    readonly agents: ReadonlyArray<AccessAgentView>
}

/** The words of the SMTP extras. */
export interface RowSmtpLabels {
    readonly defaultBadge: string
    readonly test: string
    readonly changePassword: string
    readonly setDefault: string
    readonly testTo: string
    readonly testSend: string
    readonly newPassword: string
    readonly passwordStored: string
    readonly savePassword: string
    readonly cancel: string
}

/** The SMTP-only part of a row. */
export interface RowSmtpView {
    readonly labels: RowSmtpLabels
    readonly isDefault: boolean
    readonly canSetDefault: boolean
    readonly panel: "test" | "password" | null
    readonly to: string
    readonly password: string
    readonly isPending: boolean
    readonly note: { readonly tone: "affirmative" | "negative"; readonly text: string } | null
}

/** Everything one connection row draws, as data. */
export interface RowView {
    readonly id: string
    readonly title: string
    readonly logo: { readonly src?: string; readonly isWordmark: boolean }
    readonly statusLabel: string
    readonly statusTone: "success" | "danger" | "warning" | "neutral"
    readonly envLabel: string | null
    readonly facts: string
    readonly telegramHandle: string | null
    readonly usedBy: string
    readonly state: "negative" | "cautionary" | "unavailable" | "neutral"
    readonly primary: RowPrimary | null
    readonly access: AccessView | null
    readonly menuLabel: string
    readonly menuIsDisabled: boolean
    readonly menu: ReadonlyArray<RowMenuSection>
    readonly alerts: ReadonlyArray<RowAlert>
    readonly notes: ReadonlyArray<string>
    readonly smtp: RowSmtpView | null
    readonly keys: RowKeys | null
    readonly copy: RowCopyLabels
    readonly note: RowNote | null
    readonly disconnect: RowDialog
    readonly remove: RowDialog
}
