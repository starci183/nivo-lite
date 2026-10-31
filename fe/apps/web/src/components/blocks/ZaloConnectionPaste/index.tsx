"use client"

import { useTranslations } from "next-intl"
import { useCopyLabels } from "@/hooks/connection-wizard"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloHead, useZaloOaSecret, useZaloPage, useZaloPaste } from "@/hooks/zaloConnection"
import { ZaloConnectionPasteBase } from "./component"

/** What the page hands the step body: the connection of the url. */
interface ZaloConnectionPasteProps {
    readonly connectionId: string
}

/** The connected body of the second setup step: the addresses built from the app's public url configuration, and the OA Secret Key. */
export const ZaloConnectionPaste = (props: ZaloConnectionPasteProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const copyLabels = useCopyLabels()
    const paste = useZaloPaste(props.connectionId)
    const { slot, reload } = useZaloPage(props.connectionId)
    const { isOwner } = useZaloHead(props.connectionId)
    const secret = useZaloOaSecret(props.connectionId)
    const mask = slot.items?.oaSecretMask ?? null
    return (
        <ZaloConnectionPasteBase
            props={{
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
            }}
            on={{ retry: reload, changeSecret: secret.change, saveSecret: () => void secret.save() }}
        />
    )
}
