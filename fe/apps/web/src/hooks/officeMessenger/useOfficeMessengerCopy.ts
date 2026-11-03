"use client"

import { useOfficeWords } from "@/hooks/office"
import type { OfficeText } from "@/modules/types"

/** The actual inputs that change composer wording and attachment display. */
type MessengerCopyInput = {
    readonly chatbotHandle: string | null
    readonly fileName: string | null
    readonly problem: string | null
    readonly accept: string
}

const chromeOf = (text: OfficeText) => ({
    headerCopy: {
        back: text("back"),
        tasksTitle: text("tasksTitle"),
        mutedChat: text("mutedChat"),
        tasksBack: text("tasksBack"),
        unmuteChat: text("unmuteChat"),
        muteChat: text("muteChat"),
        infoClose: text("infoClose"),
        infoOpen: text("infoOpen"),
    },
    infoCopy: {
        pendingTitle: text("pendingTitle"),
        pendingNone: text("pendingNone"),
        pendingJump: text("pendingJump"),
        exceptionsTitle: text("exceptionsTitle"),
        exceptionsNone: text("exceptionsNone"),
        exceptionJump: text("exceptionJump"),
        tasksTitle: text("tasksTitle"),
        tasksOpen: text("tasksOpen"),
        membersTitle: text("membersTitle"),
        youTag: text("youTag"),
        mention: text("mention"),
        chat11: text("chat11"),
        addAgent: text("addAgent"),
        cardsTitle: text("cardsTitle"),
        channelsTitle: text("channelsTitle"),
        pinsTitle: text("pinsTitle"),
    },
    labels: {
        messenger: text("messengerLabel"),
        list: text("listTitle"),
        info: text("infoTitle"),
        infoOpen: text("infoOpen"),
        infoClose: text("infoClose"),
        tasks: text("tasksTitle"),
        conversation: text("conversationLabel"),
        nivoCore: text("nivoCore"),
        aiBadge: text("aiBadge"),
    },
})

type UseOfficeMessengerCopyResult = {
    chrome: {
        headerCopy: {
            back: string
            tasksTitle: string
            mutedChat: string
            tasksBack: string
            unmuteChat: string
            muteChat: string
            infoClose: string
            infoOpen: string
        }
        infoCopy: {
            pendingTitle: string
            pendingNone: string
            pendingJump: string
            exceptionsTitle: string
            exceptionsNone: string
            exceptionJump: string
            tasksTitle: string
            tasksOpen: string
            membersTitle: string
            youTag: string
            mention: string
            chat11: string
            addAgent: string
            cardsTitle: string
            channelsTitle: string
            pinsTitle: string
        }
        labels: {
            messenger: string
            list: string
            info: string
            infoOpen: string
            infoClose: string
            tasks: string
            conversation: string
            nivoCore: string
            aiBadge: string
        }
    }
    composer: {
        prompts: string[]
        copy: {
            quickLabel: string
            removeFile: string
            attachFile: string
            mentionButton: string
            composerLabel: string
            composerPlaceholder: string
            mentionLabel: string
            send: string
            composerHint: string
        }
        file: {
            name: string | null
            problem: string | null
            accept: string
        }
    }
}

/** Resolves the messenger chrome and composer labels in the active Office locale. */
export const useOfficeMessengerCopy = (input: MessengerCopyInput): UseOfficeMessengerCopyResult => {
    const { t } = useOfficeWords()
    return {
        chrome: chromeOf(t),
        composer: {
            prompts: [
                t("promptNivoAuthority"),
                t("promptNivoExceptions"),
                t("promptAttention"),
                t("promptSummary"),
                t("promptInvoices"),
                ...(input.chatbotHandle === null ? [] : [t("promptChatbot", { handle: input.chatbotHandle })]),
            ],
            copy: {
                quickLabel: t("quickLabel"),
                removeFile: t("removeFile"),
                attachFile: t("attachFile"),
                mentionButton: t("mentionButton"),
                composerLabel: t("composerLabel"),
                composerPlaceholder: t("composerPlaceholder"),
                mentionLabel: t("mentionLabel"),
                send: t("send"),
                composerHint: t("composerHint"),
            },
            file: {
                name: input.fileName,
                problem: input.problem === null ? null : t(input.problem),
                accept: input.accept,
            },
        },
    }
}
