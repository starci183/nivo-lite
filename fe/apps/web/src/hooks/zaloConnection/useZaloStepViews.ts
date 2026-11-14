"use client"

import { useTranslations } from "next-intl"
import { useCopyLabels } from "@/hooks/connection-wizard"
import { useConnectionGrantsBand } from "@/hooks/connectionsPanes"
import { useSlotLabels } from "@/hooks/slot"
import type {
    DataSlot,
    SlotLabels,
    ZaloCheckLineView,
    ZaloPasteView,
    ZaloSendView,
} from "@/modules/types"
import { useZaloChecks } from "./useZaloChecks"
import { useZaloPage } from "./useZaloPage"
import { useZaloPaste } from "./useZaloPaste"
import { useZaloSetupSteps } from "./useZaloSetupSteps"
import { useZaloTestSend } from "./useZaloTestSend"

/** What the four steps of a Zalo OA connection that the form does not cover draw, in the words of the reader, and the commands behind them. */
interface ZaloStepViews {
    readonly steps: ReturnType<typeof useZaloSetupSteps>["steps"]
    readonly stepsLabel: string
    readonly paste: {
        readonly openZalo: { readonly label: string; readonly href: string }
        readonly callbackLabel: string
        readonly paste: DataSlot<ZaloPasteView>
        readonly slotLabels: SlotLabels
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly copyErrorLabel: string
    }
    readonly authorize: {
        readonly notice: string
        readonly action: ReturnType<typeof useZaloSetupSteps>["authorize"]
    }
    readonly checks: {
        readonly title: string
        readonly lines: DataSlot<ReadonlyArray<ZaloCheckLineView>>
        readonly slotLabels: SlotLabels
        readonly markLabels: Readonly<Record<ZaloCheckLineView["mark"], string>>
        readonly sendView: DataSlot<ZaloSendView>
        readonly sendLabels: SlotLabels
        readonly send: {
            readonly title: string
            readonly hint: string
            readonly recipientLabel: string
            readonly recipientEmpty: string
            readonly recipientId: string
            readonly textLabel: string
            readonly text: string
            readonly sendLabel: string
            readonly isSending: boolean
            readonly note: string
            readonly noteTone: "affirmative" | "negative"
        }
    }
    readonly grants: ReturnType<typeof useConnectionGrantsBand>
    readonly on: {
        readonly toggle: (id: string, isOpen: boolean) => void
        readonly retry: () => void
        readonly authorize: () => void
        readonly pickRecipient: (id: string) => void
        readonly changeText: (text: string) => void
        readonly send: () => void
    }
}

/** The setup steps of a Zalo OA connection the form does not cover: the words and data of each step body, read together so the steps draw as one list. */
export const useZaloStepViews = (connectionId: string): ZaloStepViews => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const copyLabels = useCopyLabels()
    const setup = useZaloSetupSteps(connectionId)
    const paste = useZaloPaste(connectionId)
    const { reload } = useZaloPage(connectionId)
    const { lines } = useZaloChecks(connectionId)
    const sender = useZaloTestSend(connectionId)
    const grants = useConnectionGrantsBand(connectionId)
    return {
        steps: setup.steps.filter((step) => step.id !== "app"),
        stepsLabel: setup.stepsLabel,
        paste: {
            openZalo: setup.openZalo,
            callbackLabel: t("pasteCallback"),
            paste,
            slotLabels: slotLabels(t("pasteEmpty")),
            copyLabel: copyLabels.copy,
            copiedLabel: copyLabels.copied,
            copyErrorLabel: t("copyFailed"),
        },
        authorize: { notice: setup.authorizeNotice, action: setup.authorize },
        checks: {
            title: t("checksTitle"),
            lines,
            slotLabels: slotLabels(t("checksEmpty")),
            markLabels: { ok: t("markOk"), fail: t("markFail"), warn: t("markWarn") },
            sendView: sender.view,
            sendLabels: slotLabels(t("testEmpty")),
            send: {
                title: t("testTitle"),
                hint: t("testHint"),
                recipientLabel: t("testRecipient"),
                recipientEmpty: t("testRecipientEmpty"),
                recipientId: sender.recipientId,
                textLabel: t("testText"),
                text: sender.text,
                sendLabel: t("testSend"),
                isSending: sender.isSending,
                note: sender.note,
                noteTone: sender.isNoteOk ? "affirmative" : "negative",
            },
        },
        grants,
        on: {
            toggle: (id, isOpen) => {
                const step = setup.steps.find((candidate) => candidate.id === id)
                if (step !== undefined) setup.toggle(step.id, isOpen)
            },
            retry: reload,
            authorize: setup.runAuthorize,
            pickRecipient: sender.setRecipient,
            changeText: sender.setText,
            send: () => void sender.send(),
        },
    }
}
