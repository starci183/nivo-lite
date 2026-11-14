"use client"

import { useTranslations } from "next-intl"
import { useConnectionForm } from "@/hooks/connectionForm"
import { useSlotLabels } from "@/hooks/slot"
import { ConnectionFormCardBase } from "./component"

/**
 * The Connection card of an account's Config tab: the display name and the fields its provider declares, read and saved through the
 * form state the page head shares (its "Save" and "Test connection"). Nothing where no page provides the form.
 */
export const ConnectionFormCard = () => {
    const t = useTranslations("providerPage")
    const slotLabels = useSlotLabels()
    const form = useConnectionForm()
    if (form === null) return null
    return (
        <ConnectionFormCardBase
            props={{
                words: {
                    title: t("formCardTitle"),
                    nameLabel: t("formNameLabel"),
                    sealedHint: t("formSealedHint"),
                    choicePlaceholder: t("formChoicePlaceholder"),
                    copyLabel: t("formCopy"),
                    copiedLabel: t("formCopied"),
                    confirmTitle: t("formConfirmTitle"),
                    confirmLabel: t("formConfirmAction"),
                    cancelLabel: t("formCancel"),
                },
                slot: form.slot,
                placeholder: form.placeholder,
                slotLabels: slotLabels(t("formCardTitle")),
                isDisabled: form.isSaving,
                runningAction: form.runningAction,
                question: form.question,
            }}
            on={{ ...form.on, retry: form.retry }}
        />
    )
}
