/** Which decision a row takes: the agent work item behind it, or an availability change. */
type RequestsDecisionKind = "item" | "availability"

/** One request, already worded for the reader's language. */
interface RequestsRequestRowView {
    readonly id: string
    readonly title: string
    readonly notes: ReadonlyArray<string>
    readonly tone: "success" | "neutral" | "warning"
    readonly badge: string
    /** Set when the manager can still decide the row. */
    readonly decision: { readonly kind: RequestsDecisionKind; readonly targetId: string } | null
}

/** A titled group of requests. */
interface RequestsRequestSectionView {
    readonly id: string
    readonly title: string
    readonly hint: string
    readonly rows: ReadonlyArray<RequestsRequestRowView>
}

/** Actual resolved requests drawings, shared by the world controller and pure ready anatomy. */
export interface ShiftsRequestViews {
    readonly requestsReady: {
        readonly isVisible: boolean
        readonly requests: ShiftsRequestViews["requestsData"] | undefined
    }
    readonly requestsCopy: { readonly requests: Omit<ShiftsRequestViews["requests"], "sections" | "recent"> }

    readonly requestsData: Pick<ShiftsRequestViews["requests"], "sections" | "recent">

    readonly requests: {
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly recentTitle: string
        readonly approveLabel: string
        readonly declineLabel: string
        readonly sections: ReadonlyArray<RequestsRequestSectionView>
        readonly recent: ReadonlyArray<RequestsRequestRowView>
        readonly isBusy: boolean
    }
    readonly requestsDecisionKind: RequestsDecisionKind
    readonly requestsRequestRowView: RequestsRequestRowView
    readonly requestsRequestSectionView: RequestsRequestSectionView
}

/** Commands stay separate from the resolved requests data contract. */
export interface ShiftsRequestActions {
    readonly requests: {
        readonly approve: (kind: RequestsDecisionKind, targetId: string) => void
        readonly decline: (kind: RequestsDecisionKind, targetId: string) => void
    }
}
