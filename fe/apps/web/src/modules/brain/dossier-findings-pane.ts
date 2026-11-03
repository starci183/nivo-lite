import type { DataSlot, SlotLabels } from "@/modules/types"
import type { FindingDialogView, FindingRowView } from "./finding-row"

/** The findings pane of one dossier: its frame, the filter and the rows. */
export interface DossierFindingsPane {
    isVisible: boolean
    frame: {
        title: string
        badges: (
            | { id: string; label: string; tone: "success" | "neutral" | "danger" | "warning" | "accent" }
            | { id: string; label: string; tone: "muted" }
        )[]
        reviewedLine: string
        isRunning: boolean
        runningLabel: string
        reviewLabel: string | null
        isReviewPending: boolean
        aiNotice: string | null
        hasNextPage: boolean
        isLoadingMore: boolean
        loadMoreLabel: string
        pageFailure: string | null
        retryLabel: string
        dialog: FindingDialogView | null
    }
    filterLabel: string
    filters: { value: "open" | "confirmed" | "closed"; label: string }[]
    filter: "open" | "confirmed" | "closed"
    listLabel: string
    slot: DataSlot<FindingRowView[]>
    slotLabels: SlotLabels
}
