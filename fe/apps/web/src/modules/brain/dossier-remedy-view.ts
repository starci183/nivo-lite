import type { PresentationState } from "@starci/grammar/common"
import type { DataSlot, SlotLabels } from "@/modules/types"
import type { EvidenceItemView } from "./finding-row"

/** The draft as the drawer draws it. */
export interface DraftContent {
    readonly id: string
    readonly findingId: string
    readonly status: string
    readonly title: string
    readonly body: string
    readonly placeholders: ReadonlyArray<EvidenceItemView>
}

/** Where the draft stands when that is worth a line: being written, failed, filed or turned down. */
export interface DraftNoticeView {
    readonly tone: PresentationState
    readonly title: string
    readonly description: string | undefined
}

/** Copy and values the draft drawer supplies. */
export interface DossierRemedyDrawerProps {
    readonly props: {
        readonly isOpen: boolean
        readonly title: string
        readonly closeLabel: string
        readonly note: string
        readonly titleFieldLabel: string
        readonly bodyFieldLabel: string
        readonly placeholdersTitle: string
        readonly evidenceTitle: string
        readonly findingTitle: string | null
        readonly evidence: ReadonlyArray<EvidenceItemView>
        readonly notice: DraftNoticeView | null
        readonly slot: DataSlot<DraftContent>
        readonly placeholder: DraftContent
        readonly slotLabels: SlotLabels
        /** The title and body as the person has them now, edits included. */
        readonly draftTitle: string
        readonly draftBody: string
        /** The owner or manager may edit and decide a draft that is proposed; everyone else reads. */
        readonly canDecide: boolean
        readonly isDirty: boolean
        readonly isPending: boolean
        readonly rejectLabel: string
        readonly saveLabel: string
        readonly approveLabel: string
    }
    readonly on: {
        readonly close: () => void
        readonly setTitle: (value: string) => void
        readonly setBody: (value: string) => void
        readonly save: () => void
        readonly reject: () => void
        readonly approve: () => void
        readonly retry: () => void
    }
}
