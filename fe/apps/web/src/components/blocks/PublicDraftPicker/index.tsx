"use client"

import { useTranslations } from "next-intl"
import { usePublicDraftController, useFailureToast } from "@/hooks/brain"
import { useSlotLabels } from "@/hooks/slot"
import { PublicDraftPickerBase } from "./component"

/** Props for the connected picker: whether the address asks for it. */
interface PublicDraftPickerProps {
    /** The `compose` of the address is `pick`. */
    readonly isOpen: boolean
}

/**
 * The connected picker of a draft by NIVO: the owner names the internal documents to draft from (one to five, ready) and may add a
 * note. NIVO drafts with no customer present and shows what it left out; nothing reaches a customer before the owner approves.
 */
export const PublicDraftPicker = (props: PublicDraftPickerProps) => {
    const t = useTranslations("publicBrain")
    const failed = useFailureToast()
    const controller = usePublicDraftController()
    const slotLabels = useSlotLabels()
    if (!controller.canWrite) return null
    return (
        <PublicDraftPickerBase
            props={{
                isOpen: props.isOpen,
                isPending: controller.isPending,
                title: t("pickTitle"),
                closeLabel: t("cancel"),
                cancelLabel: t("cancel"),
                submitLabel: t("pickSubmit"),
                note: t("pickNote"),
                titleLabel: t("pickTitleLabel"),
                sourcesLabel: t("pickSourcesLabel"),
                sourcesHint: t("pickSourcesHint", { max: controller.maxSources }),
                slotLabels: slotLabels(t("pickNoSources")),
                instructionsLabel: t("pickInstructionsLabel"),
                sources: controller.sources,
                docTitle: controller.title,
                selected: controller.selected,
                instructions: controller.instructions,
                error: controller.error,
                failTitle: t("loadFailed"),
            }}
            on={{
                close: controller.close,
                submit: () => {
                    controller.submit().catch(() => {
                        failed()
                    })
                },
                setTitle: controller.setTitle,
                setSelected: controller.setSelected,
                setInstructions: controller.setInstructions,
                retry: controller.reload,
            }}
        />
    )
}
