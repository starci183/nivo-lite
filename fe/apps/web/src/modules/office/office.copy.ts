import type { OfficeText } from "@/modules/types"

/** Resolves the thread and message controls from the Office locale. */
export const threadCopyOf = (text: OfficeText) => ({
    thread: {
        loadEarlier: text("loadEarlier"),
        emptyMessage: text("emptyMessage"),
        emptyMessageHint: text("emptyMessageHint"),
    },
    message: {
        copied: text("copied"),
        copyText: text("copyText"),
        reply: text("reply"),
        cmdOpenWork: text("cmdOpenWork"),
        aiBadge: text("aiBadge"),
    },
    outbox: { sendFailed: text("sendFailed"), sending: text("sending") },
})

/** Resolves the controls used by the different decision card kinds. */
export const cardCopyOf = (text: OfficeText) => ({
    exceptionForm: {
        exceptionMissingHint: text("exceptionMissingHint"),
        basisNeeded: text("basisNeeded"),
        waitingManager: text("waitingManager"),
        exceptionSaveContinue: text("exceptionSaveContinue"),
        exceptionCancelEdit: text("exceptionCancelEdit"),
        exceptionEditContinue: text("exceptionEditContinue"),
        exceptionReject: text("exceptionReject"),
        exceptionMissing: text("exceptionMissing"),
        basisLabel: text("basisLabel"),
        basisPlaceholder: text("basisPlaceholder"),
        exceptionCandidates: text("exceptionCandidates"),
        exceptionDraft: text("exceptionDraft"),
        exceptionAmount: text("exceptionAmount"),
        exceptionApprove: text("exceptionApprove"),
        exceptionSendDraft: text("exceptionSendDraft"),
    },
    command: {
        cmdRowAgent: text("cmdRowAgent"),
        cmdRowCommand: text("cmdRowCommand"),
        cmdPending: text("cmdPending"),
        cmdSentBadge: text("cmdSentBadge"),
        cmdCancelledBadge: text("cmdCancelledBadge"),
        cmdFailed: text("cmdFailed"),
        cmdCancel: text("cmdCancel"),
        cmdSend: text("cmdSend"),
        cmdOpenWork: text("cmdOpenWork"),
    },
    approval: {
        draftLabel: text("draftLabel"),
        showLess: text("showLess"),
        showMore: text("showMore"),
        waitingManager: text("waitingManager"),
        approveEdited: text("approveEdited"),
        approveSend: text("approveSend"),
        cancelEdit: text("cancelEdit"),
        edit: text("edit"),
        reject: text("reject"),
        aiBadge: text("aiBadge"),
        openLead: text("openLead"),
    },
    exception: {
        reconcileCredit: text("reconcileCredit"),
        reconcileWarning: text("reconcileWarning"),
        exceptionResult: text("exceptionResult"),
        exceptionOpenLead: text("exceptionOpenLead"),
        exceptionProposes: text("exceptionProposes"),
        exceptionErrorLabel: text("exceptionErrorLabel"),
        exceptionAsked: text("exceptionAsked"),
        exceptionWillReply: text("exceptionWillReply"),
    },
    result: {
        approveEdited: text("approveEdited"),
        cardApprove: text("cardApprove"),
        cancelEdit: text("cancelEdit"),
        edit: text("edit"),
        cardDecline: text("cardDecline"),
        waitingManager: text("waitingManager"),
        draftLabel: text("draftLabel"),
        cardSources: text("cardSources"),
    },
})
