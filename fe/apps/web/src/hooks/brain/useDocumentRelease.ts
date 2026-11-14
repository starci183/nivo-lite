"use client"

import { useTranslations } from "next-intl"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { loadingSlot, mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryBrainCritiqueSwr } from "@/hooks/swr"
import { documentReleaseViewOf, type ReleaseWords } from "@/modules/brain"
import type { DocumentReleasePanelView, DocumentReleaseView } from "@/modules/types"
import { useCritiqueCommands } from "./useCritiqueCommands"

/** What the release card needs: the document of the address. */
interface DocumentReleaseInput {
    readonly sourceId?: string | undefined
    /** The route still loads: the card draws its skeleton whatever the read says. */
    readonly isLoading?: boolean | undefined
}

/** The card of a document that is still being read: the same shape, so its skeleton is the loaded card. */
const placeholderOf = (t: ReturnType<typeof useTranslations>): DocumentReleaseView => ({
    title: t("release.title"),
    readable: t("release.readable", { count: 0 }),
    rows: [{ id: "held", term: t("release.heldTerm"), value: t("serving.reason.open_points", { count: 0 }) }],
    seePoints: t("release.seePoints", { count: 0 }),
    release: null,
})

/**
 * What customers may read of one document and what holds the rest: the passages held under an open point, the passages that wait for
 * the critic's review, and for the owner the one command that serves only the passages waiting for the review (never the held ones).
 */
export const useDocumentRelease = (
    input: DocumentReleaseInput,
): {
    readonly view: DocumentReleasePanelView
    readonly on: { readonly release: () => Promise<void>; readonly retry: () => void }
} => {
    const t = useTranslations("brainCritique")
    const member = useWorkspaceMember()
    const read = useQueryBrainCritiqueSwr(input.sourceId === undefined ? null : { sourceId: input.sourceId })
    const commands = useCritiqueCommands()
    const slotLabels = useSlotLabels()
    const words: ReleaseWords = {
        readable: (count) => t("release.readable", { count }),
        held: (count) => ({ term: t("release.heldTerm"), value: t("serving.reason.open_points", { count }) }),
        unreviewed: (count) => ({ term: t("release.unreviewedTerm"), value: t("serving.reason.unreviewed", { count }) }),
        allServed: { term: t("release.servedTerm"), value: t("release.servedValue") },
        seePoints: (count) => t("release.seePoints", { count }),
        release: t("release.action"),
        confirm: (count) => ({
            title: t("release.confirmTitle"),
            description: t("release.confirmBody", { count }),
            confirmLabel: t("release.confirmAction"),
            cancelLabel: t("release.confirmCancel"),
        }),
    }
    const viewer = { isOwner: member.role === "owner", isReleasing: commands.isReleasing }
    return {
        view: {
            slot:
                input.isLoading === true
                    ? loadingSlot()
                    : mapSlot(slotOfSwr(read), (data) => documentReleaseViewOf(data, words, viewer)),
            placeholder: placeholderOf(t),
            slotLabels: { ...slotLabels(t("emptyTitle")), error: t("errorTitle") },
            label: t("release.label"),
            errorBody: t("errorBody"),
        },
        on: {
            release: async () => {
                if (input.sourceId !== undefined) await commands.release(input.sourceId)
            },
            retry: () => void read.mutate(),
        },
    }
}
