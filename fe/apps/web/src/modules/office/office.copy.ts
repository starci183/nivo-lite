import type { OfficeText } from "@/modules/types"

type ThreadCopyOfResult = {
    thread: {
        loadEarlier: string
        emptyMessage: string
        emptyMessageHint: string
    }
    message: {
        copied: string
        copyText: string
        reply: string
        cmdOpenWork: string
        aiBadge: string
    }
    outbox: {
        sendFailed: string
        sending: string
    }
}

/** Resolves the thread and message controls from the Office locale. */
export const threadCopyOf = (text: OfficeText): ThreadCopyOfResult => ({
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

type CardCopyOfResult = {
    exceptionForm: {
        exceptionMissingHint: string
        basisNeeded: string
        waitingManager: string
        exceptionSaveContinue: string
        exceptionCancelEdit: string
        exceptionEditContinue: string
        exceptionReject: string
        exceptionMissing: string
        basisLabel: string
        basisPlaceholder: string
        exceptionCandidates: string
        exceptionDraft: string
        exceptionAmount: string
        exceptionApprove: string
        exceptionSendDraft: string
    }
    command: {
        cmdRowAgent: string
        cmdRowCommand: string
        cmdPending: string
        cmdSentBadge: string
        cmdCancelledBadge: string
        cmdFailed: string
        cmdCancel: string
        cmdSend: string
        cmdOpenWork: string
    }
    approval: {
        draftLabel: string
        showLess: string
        showMore: string
        waitingManager: string
        approveEdited: string
        approveSend: string
        cancelEdit: string
        edit: string
        reject: string
        aiBadge: string
        openLead: string
    }
    exception: {
        reconcileCredit: string
        reconcileWarning: string
        exceptionResult: string
        exceptionOpenLead: string
        exceptionProposes: string
        exceptionErrorLabel: string
        exceptionAsked: string
        exceptionWillReply: string
    }
    result: {
        approveEdited: string
        cardApprove: string
        cancelEdit: string
        edit: string
        cardDecline: string
        waitingManager: string
        draftLabel: string
        cardSources: string
    }
}

/** Resolves the controls used by the different decision card kinds. */
export const cardCopyOf = (text: OfficeText): CardCopyOfResult => ({
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
