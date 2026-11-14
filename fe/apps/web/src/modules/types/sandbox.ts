import type { DataSlot } from "./slot"

/** The words of the Sandbox page, resolved once by the connected half (the pure half holds no copy). */
export interface SandboxCopy {
    readonly title: string
    readonly description: string
    readonly openAction: string
    readonly cancelLabel: string
    /** The notice of a production environment: no sandbox exists there. */
    readonly offTitle: string
    readonly offBody: string
    /** The notice of a viewer who may not use the page. */
    readonly staffTitle: string
    readonly staffBody: string
    readonly failTitle: string
    readonly failBody: string
    readonly retryLabel: string
    readonly accounts: {
        readonly title: string
        readonly listLabel: string
        readonly badge: string
        readonly emptyTitle: string
        readonly emptyBody: string
    }
    readonly cases: {
        readonly title: string
        readonly empty: string
        readonly sendLabel: string
        readonly pickLabel: string
        readonly defaultBadge: string
        readonly nextBadge: string
        readonly inputsLabel: string
        readonly errorTitle: string
    }
    readonly calls: {
        readonly title: string
        readonly empty: string
        readonly moreLabel: string
        readonly clearLabel: string
        readonly failedBadge: string
        readonly errorTitle: string
        readonly clearTitle: string
        readonly clearBody: string
        readonly clearConfirm: string
    }
    readonly webhookKey: {
        readonly title: string
        readonly hint: string
        readonly revealLabel: string
        readonly hideLabel: string
        readonly copyLabel: string
        readonly errorTitle: string
    }
    readonly waiting: {
        readonly title: string
        readonly empty: string
        readonly expireLabel: string
        readonly errorTitle: string
        /** "{time} left": the copy around the countdown, with its {time}. */
        readonly leftTemplate: string
        /** What the countdown says once the wait is due. */
        readonly dueLabel: string
    }
    readonly open: {
        readonly title: string
        readonly hint: string
        readonly providerLabel: string
        readonly nameLabel: string
        readonly submitLabel: string
        /** The label over the choice list of the agents the new account is given to. */
        readonly agentsLabel: string
    }
    readonly agents: {
        readonly title: string
        readonly empty: string
        readonly attachLabel: string
        readonly detachLabel: string
        readonly makeDefaultLabel: string
        readonly defaultBadge: string
        readonly errorTitle: string
        readonly detachTitle: string
        readonly detachBody: string
        readonly detachConfirm: string
    }
    readonly attach: {
        readonly title: string
        readonly hint: string
        readonly agentsLabel: string
        readonly empty: string
        readonly submitLabel: string
    }
}

/** One sandbox account as a row of the left rail. */
export interface SandboxAccountRowView {
    readonly id: string
    readonly name: string
    /** The mark of the provider; null when the app has none (the glyph is drawn instead). */
    readonly logo: string | null
    /** The agents the account is attached to, as one muted line ("Chatbot, Sales"); the words for none when it has none. */
    readonly agentsLine: string
}

/** The accounts of one provider: its name over its rows. */
export interface SandboxAccountGroupView {
    readonly provider: string
    readonly label: string
    readonly rows: ReadonlyArray<SandboxAccountRowView>
}

/** The sandbox accounts of the workspace, grouped by provider. */
export interface SandboxAccountsData {
    readonly groups: ReadonlyArray<SandboxAccountGroupView>
    readonly count: number
    /** The account the right column shows. */
    readonly selectedId: string
}

/** One agent the open account is attached to. */
export interface SandboxAgentRowView {
    readonly id: string
    readonly name: string
    /** The account is the agent's default among its accounts of this provider (shown only where it holds several). */
    readonly isDefault: boolean
    /** The agent holds several accounts of this provider and this one is not its default: the owner may make it so. */
    readonly canSetDefault: boolean
}

/** The agents block of the open account. */
export interface SandboxAgentsData {
    readonly rows: ReadonlyArray<SandboxAgentRowView>
}

/** One agent the owner may choose in a drawer. */
export interface SandboxAgentChoice {
    readonly id: string
    readonly label: string
}

/** One case of the open account's provider. */
export interface SandboxCaseRowView {
    readonly id: string
    readonly label: string
    readonly direction: "inbound" | "outbound"
    /** What the provider is asked for; null for an inbound case. */
    readonly operation: string | null
    readonly isDefault: boolean
    /** An outbound case the account answers next. */
    readonly isNext: boolean
}

/** One input an inbound case takes, with the value the form holds. */
export interface SandboxInputView {
    readonly name: string
    readonly label: string
    /** The example the case ships with, shown while the field is empty. */
    readonly placeholder: string
    readonly value: string
}

/** The cases block of the open account. */
export interface SandboxCasesData {
    readonly rows: ReadonlyArray<SandboxCaseRowView>
    readonly fields: ReadonlyArray<SandboxInputView>
    /** "Latest request: ..." (12, muted); null when the agent has asked for nothing yet. */
    readonly latestLine: string | null
    /** One line per outbound operation with the case it answers next. */
    readonly nextLines: ReadonlyArray<string>
}

/** One line of the call log. */
export interface SandboxCallRowView {
    readonly id: string
    readonly title: string
    /** The case or key, the time and, when the call threw, why (12, muted). */
    readonly line: string
    readonly isFailed: boolean
}

/** The call log of the open account, newest first, bounded to what is drawn. */
export interface SandboxCallsData {
    readonly rows: ReadonlyArray<SandboxCallRowView>
    readonly hasMore: boolean
}

/** One run parked at a wait. */
export interface SandboxWaitingRowView {
    readonly runId: string
    /** "<agent> · <person or route>". */
    readonly title: string
    /** What it waits for (12, muted); the time left follows it. */
    readonly what: string
    /** When the wait ends (an RFC 3339 moment): the card counts down to it. */
    readonly dueAt: string
}

/** The drawer that opens a sandbox account. */
export interface SandboxOpenView {
    readonly isOpen: boolean
    readonly isPending: boolean
    readonly providers: DataSlot<ReadonlyArray<{ readonly id: string; readonly label: string }>>
    readonly provider: string | null
    readonly name: string
    /** The agents the account is read for (a choice list); read while the drawer is open. */
    readonly agents: DataSlot<ReadonlyArray<SandboxAgentChoice>>
    /** The agents chosen to receive the new account. */
    readonly agentIds: ReadonlyArray<string>
}

/** The drawer that gives the open account to more agents. */
export interface SandboxAttachView {
    readonly isOpen: boolean
    readonly isPending: boolean
    /** The agents the account is not attached to yet. */
    readonly agents: DataSlot<ReadonlyArray<SandboxAgentChoice>>
    readonly agentIds: ReadonlyArray<string>
}

/** The agent whose detach the owner is asked to confirm. */
export interface SandboxDetachAsk {
    readonly agentId: string
    readonly name: string
}

/** What is running now, so only its own control shows pending. */
export interface SandboxPendingView {
    /** The inbound case being sent. */
    readonly sendingId: string | null
    /** The outbound case being chosen. */
    readonly choosingId: string | null
    /** The run whose wait is being ended. */
    readonly expiringId: string | null
    readonly isClearing: boolean
    readonly isCopying: boolean
    /** The agent being taken off the account. */
    readonly detachingId: string | null
    /** The agent being made default. */
    readonly defaultingId: string | null
}

/** The key block of the open account: hidden until the owner asks to see it. */
export interface SandboxKeyView {
    readonly isRevealed: boolean
    /** The key, read for the copy button; it is drawn only while revealed. */
    readonly value: DataSlot<string>
}

/** Which body the page draws: the notice of a viewer or an environment, or the sandbox itself. */
export type SandboxGate = "checking" | "failed" | "staff" | "off" | "on"

/** What the Sandbox page draws and does. */
export interface SandboxPanesBaseProps {
    readonly props: {
        readonly copy: SandboxCopy
        /** The reader's language, for the countdown of a wait. */
        readonly locale: string
        readonly gate: SandboxGate
        readonly accounts: DataSlot<SandboxAccountsData>
        readonly agents: DataSlot<SandboxAgentsData>
        readonly attach: SandboxAttachView
        /** The question before an agent is taken off the account; null when none is asked. */
        readonly detachAsk: SandboxDetachAsk | null
        readonly cases: DataSlot<SandboxCasesData>
        readonly calls: DataSlot<SandboxCallsData>
        readonly webhookKey: SandboxKeyView
        readonly waiting: DataSlot<ReadonlyArray<SandboxWaitingRowView>>
        readonly open: SandboxOpenView
        readonly pending: SandboxPendingView
        /** The question before the call log is cleared. */
        readonly isClearAsked: boolean
    }
    readonly on: {
        readonly retryGate: () => void
        readonly retryAccounts: () => void
        readonly retryCases: () => void
        readonly retryCalls: () => void
        readonly retryKey: () => void
        readonly retryWaiting: () => void
        readonly retryProviders: () => void
        readonly retryAgents: () => void
        readonly chooseAgents: (agentIds: ReadonlyArray<string>) => void
        readonly openAttach: () => void
        readonly closeAttach: () => void
        readonly chooseAttach: (agentIds: ReadonlyArray<string>) => void
        readonly submitAttach: () => void
        readonly askDetach: (agentId: string) => void
        readonly cancelDetach: () => void
        readonly acceptDetach: () => void
        readonly setDefault: (agentId: string) => void
        readonly select: (accountId: string) => void
        readonly openDrawer: () => void
        readonly closeDrawer: () => void
        readonly chooseProvider: (provider: string) => void
        readonly setName: (value: string) => void
        readonly submitOpen: () => void
        readonly setInput: (name: string, value: string) => void
        readonly send: (caseId: string) => void
        readonly choose: (caseId: string) => void
        readonly moreCalls: () => void
        readonly askClear: () => void
        readonly cancelClear: () => void
        readonly acceptClear: () => void
        readonly revealKey: () => void
        readonly hideKey: () => void
        readonly copyKey: () => void
        readonly expire: (runId: string) => void
    }
}
