"use client"

import { useTranslations } from "next-intl"
import { useCopyLabels } from "@/hooks/connection-wizard"
import { useConnectionsRole } from "@/hooks/connections"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { useSepayCommands } from "./useSepayCommands"
import { useSepayConnection } from "./useSepayConnection"
import { useSepayPlaceholder } from "./useSepayPlaceholder"
import { useSepayRotate } from "./useSepayRotate"
import { useSepaySettings } from "./useSepaySettings"

/** What the step that creates the webhook on SePay draws, and the commands behind it. */
interface SepayPasteView {
    readonly view: {
        readonly slot: DataSlot<{ readonly webhookUrl: string; readonly apiKeyMasked: string }>
        readonly placeholder: { readonly webhookUrl: string; readonly apiKeyMasked: string }
        readonly labels: SlotLabels
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly copyErrorLabel: string
        readonly webhookLabel: string
        readonly keyLabel: string
        readonly keyNote: string
        readonly settingsLabel: string
        readonly settings: ReadonlyArray<{ readonly id: string; readonly label: string; readonly value: string }>
        readonly canEdit: boolean
        readonly rotate: {
            readonly label: string
            readonly isOpen: boolean
            readonly title: string
            readonly description: string
            readonly confirmLabel: string
            readonly cancelLabel: string
            readonly isPending: boolean
        }
    }
    readonly on: {
        readonly copyKey: () => Promise<string>
        readonly askRotate: () => void
        readonly dismissRotate: () => void
        readonly confirmRotate: () => void
    }
}

/** What to create on SePay: the address and the key to copy, the settings to pick, and the new-key command with its question. */
export const useSepayPasteView = (connectionId: string): SepayPasteView => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const copy = useCopyLabels()
    const commands = useSepayCommands(connectionId)
    const rotate = useSepayRotate(commands.rotateKey)
    const { role } = useConnectionsRole()
    const placeholder = useSepayPlaceholder()
    const { slot } = useSepayConnection(connectionId)
    const connection = "items" in slot ? slot.items : undefined
    const settings = useSepaySettings(connection)
    return {
        view: {
            slot: mapSlot(slot, (item) => ({ webhookUrl: item.webhookUrl, apiKeyMasked: item.apiKeyMasked })),
            placeholder: { webhookUrl: placeholder.webhookUrl, apiKeyMasked: placeholder.apiKeyMasked },
            labels: slotLabels(t("loadFailed")),
            copyLabel: copy.copy,
            copiedLabel: copy.copied,
            copyErrorLabel: t("copyFailed"),
            webhookLabel: t("webhookLabel"),
            keyLabel: t("keyLabel"),
            keyNote: t("keyNote"),
            settingsLabel: t("settingsLabel"),
            settings,
            canEdit: role === "owner" && connection?.status !== "disconnected",
            rotate: {
                label: t("rotateKey"),
                isOpen: rotate.isAsking,
                title: t("rotateTitle"),
                description: t("rotateBody"),
                confirmLabel: t("rotateConfirm"),
                cancelLabel: t("cancel"),
                isPending: rotate.isRotating,
            },
        },
        on: {
            copyKey: async (): Promise<string> => {
                const settled = await commands.revealKey()
                if (settled.kind !== "ok") throw new Error(settled.message)
                return settled.value
            },
            askRotate: rotate.ask,
            dismissRotate: rotate.dismiss,
            confirmRotate: rotate.confirm,
        },
    }
}
