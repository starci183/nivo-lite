"use client"

import { useTranslations } from "next-intl"
import { DOSSIER_STATUS_TONE, dossierTagOf } from "@/modules/brain"
import type { DossierAsideView, DossierDeskView, DossierHeadView, DossierView, Opened } from "@/modules/brain"
import { brainTabHref, brainUploadHref } from "@/modules/routes"

type Translate = ReturnType<typeof useTranslations<"secondBrain">>
type DeskTranslate = ReturnType<typeof useTranslations<"brainDossiers">>
type ReviewTranslate = ReturnType<typeof useTranslations<"dossierReview">>

/** The words the head and the side pane are drawn with. */
interface AsideWords {
    readonly t: Translate
    readonly desk: DeskTranslate
    readonly review: ReviewTranslate
}

/** What the side pane of an open dossier needs besides the dossier: who may write, and the documents filed under it. */
interface AsideInput {
    readonly details: DossierAsideView["details"]
    readonly canWrite: boolean
    readonly documents: DossierAsideView["documents"]
}

/** The side pane of the open dossier: what it lacks, the way to bring it, and the documents filed under it. */
const asideOf = (words: AsideWords, opened: Opened, input: AsideInput): DossierAsideView => {
    const { dossier, category } = opened
    const note = dossier.note
    return {
        title: words.desk("asideLabel"),
        missing:
            note?.kind === "missing"
                ? {
                      title: words.desk("missingTitle"),
                      text: note.text,
                      upload: input.canWrite
                          ? {
                                label: words.t("dossierUpload"),
                                href: brainUploadHref(category.id, dossierTagOf(dossier.ref)),
                            }
                          : null,
                  }
                : null,
        details: input.details,
        documentsTitle: words.desk("documentsTitle"),
        documentsEmpty: words.desk("documentsEmpty"),
        documents: input.documents,
    }
}

/** The head band of the open dossier. */
const headOf = (words: AsideWords, opened: Opened, openCount: number | undefined): DossierHeadView => ({
    title: opened.dossier.name,
    description:
        openCount === undefined
            ? opened.category.label
            : words.desk("headLine", { category: opened.category.label, count: openCount }),
    badge: {
        label: words.t(
            opened.standing.status === "present" && opened.dossier.documentCount === 0
                ? "statusPresentNoFile"
                : `status_${opened.standing.status}`,
        ),
        tone: DOSSIER_STATUS_TONE[opened.standing.status],
    },
    documentCount: words.desk("rowDocuments", { count: opened.dossier.documentCount }),
    mapHref: brainTabHref("map", { node: opened.dossier.id }),
})

/** The head of the open dossier drawn as geometry while the first reads are in: the same boxes as a ready head. */
const WAITING_HEAD: DossierHeadView = {
    title: "-",
    description: "-",
    badge: { label: "-", tone: "neutral" },
    documentCount: "-",
    mapHref: "#",
}

/** The side pane drawn as geometry while the first reads are in: its words are real, what the dossier holds is a placeholder. */
const waitingAsideOf = (words: AsideWords, canWrite: boolean): DossierAsideView => ({
    title: words.desk("asideLabel"),
    missing: {
        title: words.desk("missingTitle"),
        text: "-",
        upload: canWrite ? { label: words.t("dossierUpload"), href: "#" } : null,
    },
    details: [
        { id: "owner", term: words.review("assignee"), text: "-" },
        { id: "due", term: words.review("dueDate"), text: "-" },
    ],
    documentsTitle: words.desk("documentsTitle"),
    documentsEmpty: words.desk("documentsEmpty"),
    documents: ["a", "b"].map((id) => ({ id, title: "-", meta: "-", href: "#" })),
})

/** What the side pane depends on. */
interface AsideState {
    readonly waiting: boolean
    readonly opened: Opened | null
    readonly isAsideShown: boolean
    readonly canWrite: boolean
    readonly documents: NonNullable<DossierDeskView["aside"]>["documents"]
    readonly details: NonNullable<DossierDeskView["aside"]>["details"]
}

/** The side pane: geometry while the reads are in, nothing while no dossier is open or the pane was closed, else the dossier's. */
const asideViewOf = (words: AsideWords, state: AsideState): DossierDeskView["aside"] => {
    if (state.waiting) return waitingAsideOf(words, state.canWrite)
    if (state.opened === null || !state.isAsideShown) return null
    return asideOf(words, state.opened, {
        canWrite: state.canWrite,
        documents: state.documents,
        details: state.details,
    })
}

/** The head band: geometry while the reads are in, nothing while no dossier is open, else the dossier's. */
const headViewOf = (
    words: AsideWords,
    waiting: boolean,
    opened: Opened | null,
    openCount: number | undefined,
): DossierHeadView | null => {
    if (waiting) return WAITING_HEAD
    return opened === null ? null : headOf(words, opened, openCount)
}

/** The two words of the owner of a dossier. */
interface OwnerWords {
    readonly ownerLabelOf: (dossier: DossierView) => string
    readonly dueLabelOf: (dossier: DossierView) => string
}

/** The head and the side pane of the dossiers desk, bound to the active language. */
export interface DossierAsideWords {
    readonly headViewOf: (
        waiting: boolean,
        opened: Opened | null,
        openCount: number | undefined,
    ) => DossierHeadView | null
    readonly asideViewOf: (state: AsideState) => DossierDeskView["aside"]
    /** The owner and the due date of a dossier as the two lines of the side pane. */
    readonly detailsOf: (owner: OwnerWords, dossier: DossierView) => DossierAsideView["details"]
}

/** The words the dossiers desk draws its head band and its side pane with, in the active language. */
export const useDossierAsideWords = (): DossierAsideWords => {
    const words: AsideWords = {
        t: useTranslations("secondBrain"),
        desk: useTranslations("brainDossiers"),
        review: useTranslations("dossierReview"),
    }
    return {
        headViewOf: (waiting, opened, openCount) => headViewOf(words, waiting, opened, openCount),
        asideViewOf: (state) => asideViewOf(words, state),
        detailsOf: (owner, dossier) => [
            { id: "owner", term: words.review("assignee"), text: owner.ownerLabelOf(dossier) },
            { id: "due", term: words.review("dueDate"), text: owner.dueLabelOf(dossier) },
        ],
    }
}
