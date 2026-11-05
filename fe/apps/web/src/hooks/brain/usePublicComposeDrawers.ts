"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { brainTabHref } from "@/modules/routes"
import type { PublicPickerDrawerView, PublicWriteDrawerView } from "@/modules/types"
import { useFailureToast } from "./useFailureToast"
import { usePublicDraftController } from "./usePublicDraftController"
import { usePublicWriteController } from "./usePublicWriteController"

/** What the address asks of the two forms that start a public document. */
interface PublicComposeInput {
    /** The `compose` of the address: the picker of internal documents, the written form, or none. */
    readonly compose: "pick" | "write" | undefined
    /** The `title` of the address: the customer question being answered; empty when none. */
    readonly title: string
}

/** The two drawers that start a public document, each ready to draw; a reader who may not write gets neither. */
interface PublicComposeDrawers {
    readonly picker: PublicPickerDrawerView | null
    readonly writer: PublicWriteDrawerView | null
}

/**
 * The drawers that start a public document: NIVO drafts it from internal documents the owner picks (one to five, ready, with a note),
 * or the owner writes it by hand (separate from any internal document). Nothing reaches a customer before the owner approves it.
 */
export const usePublicComposeDrawers = (input: PublicComposeInput): PublicComposeDrawers => {
    const t = useTranslations("publicBrain")
    const p = useTranslations("brainPublic")
    const failed = useFailureToast()
    const picker = usePublicDraftController()
    const writer = usePublicWriteController(input.title)
    const slotLabels = useSlotLabels()
    if (!picker.canWrite) return { picker: null, writer: null }
    return {
        picker: {
            props: {
                isOpen: input.compose === "pick",
                isPending: picker.isPending,
                title: t("pickTitle"),
                closeLabel: t("cancel"),
                cancelLabel: t("cancel"),
                submitLabel: t("pickSubmit"),
                note: t("pickNote"),
                writeInstead: { label: p("writeInstead"), href: brainTabHref("publicDocs", { compose: "write" }) },
                titleLabel: t("pickTitleLabel"),
                sourcesLabel: t("pickSourcesLabel"),
                sourcesHint: t("pickSourcesHint", { max: picker.maxSources }),
                slotLabels: slotLabels(t("pickNoSources")),
                instructionsLabel: t("pickInstructionsLabel"),
                sources: picker.sources,
                docTitle: picker.title,
                selected: picker.selected,
                instructions: picker.instructions,
                error: picker.error,
                failTitle: t("loadFailed"),
            },
            on: {
                close: picker.close,
                submit: () => {
                    picker.submit().catch(() => {
                        failed()
                    })
                },
                setTitle: picker.setTitle,
                setSelected: picker.setSelected,
                setInstructions: picker.setInstructions,
                retry: picker.reload,
            },
        },
        writer: {
            props: {
                isOpen: input.compose === "write",
                isPending: writer.isPending,
                title: t("writeTitle"),
                closeLabel: t("cancel"),
                cancelLabel: t("cancel"),
                submitLabel: t("writeSubmit"),
                note: t("writeNote"),
                titleLabel: t("writeTitleLabel"),
                bodyLabel: t("writeBodyLabel"),
                docTitle: writer.title,
                body: writer.body,
                error: writer.error,
                failTitle: t("loadFailed"),
            },
            on: {
                close: writer.close,
                submit: () => {
                    writer.submit().catch(() => {
                        failed()
                    })
                },
                setTitle: writer.setTitle,
                setBody: writer.setBody,
            },
        },
    }
}
