"use client"

import { useTranslations } from "next-intl"
import { useCopyLabels } from "@/hooks/connection-wizard"
import { useConnectionGrantsBand } from "@/hooks/connectionsPanes"
import { useSlotLabels } from "@/hooks/slot"
import type {
    DataSlot,
    SlotLabels,
    ZaloCheckLineView,
    ZaloFactView,
    ZaloPasteView,
    ZaloSendView,
} from "@/modules/types"
import { useZaloChecks } from "./useZaloChecks"
import { useZaloHead } from "./useZaloHead"
import { useZaloOaSecret } from "./useZaloOaSecret"
import { useZaloPage } from "./useZaloPage"
import { useZaloPaste } from "./useZaloPaste"
import { useZaloSetupFacts } from "./useZaloSetupFacts"
import { useZaloSetupSteps } from "./useZaloSetupSteps"
import { useZaloTestSend } from "./useZaloTestSend"

/** What the five steps of a Zalo OA connection draw, in the words of the reader, and the commands behind them. */
interface ZaloStepViews {
    readonly steps: ReturnType<typeof useZaloSetupSteps>["steps"]
    readonly stepsLabel: string
    readonly app: { readonly facts: DataSlot<ReadonlyArray<ZaloFactView>>; readonly slotLabels: SlotLabels }
    readonly paste: {
        readonly openZalo: { readonly label: string; readonly href: string }
        readonly callbackLabel: string
        readonly webhookLabel: string
        readonly paste: DataSlot<ZaloPasteView>
        readonly slotLabels: SlotLabels
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly copyErrorLabel: string
        readonly secret: {
            readonly label: string
            readonly description: string
            readonly value: string
            readonly error: string
            readonly saveLabel: string
            readonly isSaving: boolean
            readonly canEdit: boolean
        }
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
        readonly changeSecret: (value: string) => void
        readonly saveSecret: () => void
        readonly authorize: () => void
        readonly pickRecipient: (id: string) => void
        readonly changeText: (text: string) => void
        readonly send: () => void
    }
}

/** The five setup steps of a Zalo OA connection: the words and data of each step body, read together so the steps draw as one list. */
export const useZaloStepViews = (connectionId: string): ZaloStepViews => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const copyLabels = useCopyLabels()
    const setup = useZaloSetupSteps(connectionId)
    const facts = useZaloSetupFacts(connectionId)
    const paste = useZaloPaste(connectionId)
    const { slot, reload } = useZaloPage(connectionId)
    const { isOwner } = useZaloHead(connectionId)
    const secret = useZaloOaSecret(connectionId)
    const { lines } = useZaloChecks(connectionId)
    const sender = useZaloTestSend(connectionId)
    const grants = useConnectionGrantsBand(connectionId)
    const mask = ("items" in slot ? slot.items : undefined)?.oaSecretMask ?? null
    return {
        steps: setup.steps,
        stepsLabel: setup.stepsLabel,
        app: { facts, slotLabels: slotLabels(t("factsEmpty")) },
        paste: {
            openZalo: setup.openZalo,
            callbackLabel: t("pasteCallback"),
            webhookLabel: t("pasteWebhook"),
            paste,
            slotLabels: slotLabels(t("pasteEmpty")),
            copyLabel: copyLabels.copy,
            copiedLabel: copyLabels.copied,
            copyErrorLabel: t("copyFailed"),
            secret: {
                label: t("factOaSecret"),
                description: mask === null ? t("oaSecretMissing") : t("oaSecretStored", { mask }),
                value: secret.value,
                error: secret.error,
                saveLabel: t("oaSecretSave"),
                isSaving: secret.isSaving,
                canEdit: isOwner,
            },
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
            changeSecret: secret.change,
            saveSecret: () => void secret.save(),
            authorize: setup.runAuthorize,
            pickRecipient: sender.setRecipient,
            changeText: sender.setText,
            send: () => void sender.send(),
        },
    }
}
