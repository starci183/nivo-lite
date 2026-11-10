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

/** A provider connected after the agents were made, asking once whether to attach it by template. */
export interface PendingAttachmentView {
    readonly id: string
    readonly title: string
    readonly body: string
    readonly name: string
    readonly logo: string | undefined
    readonly laterLabel: string
    readonly attachLabel: string
}

/** The commands of the Connected tab. */
export interface ConnectionsHomeCommands {
    readonly later: (id: string) => void
    readonly attachByTemplate: (id: string) => void
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
        /** The providers waiting for "attach by template?". */
        readonly pending: ReadonlyArray<PendingAttachmentView>
    }
    readonly on: ConnectionsHomeCommands
}
