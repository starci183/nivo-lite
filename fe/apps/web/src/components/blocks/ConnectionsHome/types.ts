import type { ConnectionListRow, ConnectionsListView, DataSlot, SlotLabels } from "@/modules/types"

/** The words of the pager under the table; the page and summary lines are templates with `{page}`, `{from}`, `{to}` and `{total}` in place. */
export interface PagingCopy {
    readonly nav: string
    readonly previous: string
    readonly next: string
    readonly pageTemplate: string
    readonly summaryTemplate: string
}

/** The words of the Connected tab. */
export interface ConnectionsHomeCopy {
    readonly attentionHeading: string
    readonly figuresLabel: string
    readonly running: string
    readonly runningMeta: string
    readonly waiting: string
    readonly waitingMeta: string
    readonly needs: string
    readonly needsMeta: string
    readonly agents: string
    readonly agentsMeta: string
    readonly allHeading: string
    readonly colConnection: string
    readonly colLastEvent: string
    readonly colAgent: string
    readonly lastEventNone: string
    readonly lastEventFailed: string
    readonly agentNone: string
    readonly filterLabel: string
    /** "{count} more filters": the name of the fold menu, with the count in place. */
    readonly moreFilters: string
    readonly searchLabel: string
    readonly clearLabel: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly clearFilters: string
    readonly forbiddenBody: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly errorBody: string
    readonly paging: PagingCopy
}

/** A connected account no agent of its template holds, asking whether to attach it by template ("Attach Zalo OA · <OA name> to Sales by template?"). */
export interface PendingAttachmentView {
    readonly id: string
    readonly title: string
    readonly body: string
    readonly name: string
    readonly logo: string | undefined
    readonly laterLabel: string
    readonly attachLabel: string
}

/** The shop's default receiving account (owner only): its one row, the "Change" pill, and the picker of the accounts that can receive. */
export interface DefaultAccountView {
    readonly title: string
    readonly row: {
        readonly id: string
        readonly title: string
        readonly description: string
        /** The provider mark; absent on the "none chosen" row. */
        readonly name: string | undefined
        readonly logo: string | undefined
    }
    readonly changeLabel: string
    readonly picker: {
        readonly isOpen: boolean
        readonly title: string
        readonly closeLabel: string
        readonly items: ReadonlyArray<{ readonly id: string; readonly title: string; readonly subtitle?: string }>
        readonly value: string | null
        readonly isSaving: boolean
        readonly cancelLabel: string
        readonly saveLabel: string
    }
}

/** The commands of the Connected tab. */
export interface ConnectionsHomeCommands {
    readonly later: (id: string) => void
    readonly attachByTemplate: (id: string) => void
    readonly openDefaultPicker: () => void
    readonly closeDefaultPicker: () => void
    readonly pickDefault: (connectionId: string) => void
    readonly saveDefault: () => void
    readonly goTo: (href: string) => void
    readonly openLibrary: () => void
    readonly retry: () => void
    readonly filter: (value: string) => void
    readonly text: (value: string) => void
    readonly clearFilters: () => void
}

/** The words, the read and the controls of the Connected tab. */
export interface ConnectionsHomeBaseProps {
    readonly props: {
        readonly copy: ConnectionsHomeCopy
        readonly locale: string
        readonly slot: DataSlot<ConnectionsListView>
        readonly labels: SlotLabels
        /** The rows the search and the filter leave. */
        readonly rows: ReadonlyArray<ConnectionListRow>
        readonly filter: string
        readonly text: string
        /** The accounts waiting for "attach by template?". */
        readonly pending: ReadonlyArray<PendingAttachmentView>
        /** The default receiving account section; null when the viewer is not the owner or no account can receive. */
        readonly defaultAccount: DefaultAccountView | null
    }
    readonly on: ConnectionsHomeCommands
}
