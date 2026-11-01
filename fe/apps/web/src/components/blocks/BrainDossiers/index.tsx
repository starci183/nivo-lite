"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import {
    DOSSIER_STATUS_TONE,
    SEVERITY_TONE,
    dossierTagOf,
    reviewedStatusOf,
    statusCountsOf,
    useBrainDossiers,
    useDossierReviewSummary,
    worstSeverityOf,
} from "@/hooks/brain"
import type { CategoryView, DossierReviewRecord, DossierView } from "@/hooks/brain"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { loadingSlot, mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { brainDossierHref, brainTabHref, brainUploadHref } from "@/modules/routes"
import { placeholderDossierRows } from "@/components/composites/DossierRowsCard"
import { BrainDossiersBase } from "./component"
import type { CategoryRowView, DossierRowView, DossiersContent } from "./component"

type Translate = ReturnType<typeof useTranslations<"secondBrain">>
type ReviewTranslate = ReturnType<typeof useTranslations<"dossierReview">>

/** What the review knows when a row is worded: its words, what it computed for the dossier, which dossier is open and who may act. */
interface RowContext {
    readonly t: Translate
    readonly review: ReviewTranslate
    readonly reviewOf: (dossierId: string) => DossierReviewRecord | undefined
    readonly openId: string | undefined
    readonly canWrite: boolean
}

const placeholderCategory = (n: number): CategoryRowView => ({
    id: `placeholder-${n}`,
    title: "-",
    dossiers: placeholderDossierRows(`placeholder-${n}`),
})

/** Cards of the same shape as a ready page, drawn as geometry while the categories and dossiers are read. */
const PLACEHOLDER: DossiersContent = {
    figures: [1, 2, 3, 4].map((n) => ({ id: `placeholder-${n}`, label: "-", value: "0" })),
    categories: [1, 2].map(placeholderCategory),
}

/** The one line of a dossier: what is missing, else what is already held; nothing when the checklist says neither. */
const noteOf = (t: Translate, note: DossierView["note"]): string | null => {
    if (note === null) return null
    return note.kind === "missing" ? t("dossierMissing", { text: note.text }) : note.text
}

/** A line followed by the count of its documents; either may be missing. */
const withDocuments = (note: string | null, documents: string | null): string | null => {
    const parts = [note, documents].filter((part) => part !== null)
    return parts.length === 0 ? null : parts.join(" · ")
}

/** What a dossier asks of the owner next: look at its findings, or bring the document it lacks. */
const actionOf = (
    context: RowContext,
    category: CategoryView,
    dossier: DossierView,
    standing: ReturnType<typeof reviewedStatusOf>,
    openCount: number,
): DossierRowView["action"] => {
    if (openCount > 0) return { label: context.t("dossierSee"), href: brainDossierHref(dossier.id) }
    if (standing.status !== "missing" || !context.canWrite) return null
    return { label: context.t("dossierUpload"), href: brainUploadHref(category.id, dossierTagOf(dossier.ref)) }
}

/**
 * A dossier in the words of the list: the status the review stands at (the checklist's own until it has looked), then the count
 * of its active findings in the tone of the worst, or else its documents; the other count goes into the line.
 */
const dossierRowOf = (context: RowContext, category: CategoryView, dossier: DossierView): DossierRowView => {
    const { t, review } = context
    const reviewed = context.reviewOf(dossier.id)
    const standing = reviewedStatusOf(dossier.status, reviewed)
    const worst = reviewed === undefined ? null : worstSeverityOf(reviewed)
    const documents = t("dossierDocuments", { count: dossier.documentCount })
    const note = withDocuments(noteOf(t, dossier.note), dossier.documentCount > 0 ? documents : null)
    const status = {
        id: "status",
        label: t(
            standing.status === "present" && dossier.documentCount === 0
                ? "statusPresentNoFile"
                : `status_${standing.status}`,
        ),
        tone: DOSSIER_STATUS_TONE[standing.status],
    }
    return {
        id: dossier.id,
        name: dossier.name,
        isSelected: dossier.id === context.openId,
        note: worst === null ? note : withDocuments(note, documents),
        badges:
            reviewed === undefined || worst === null
                ? [status]
                : [
                      status,
                      {
                          id: "findings",
                          label: review("findingsCount", { count: reviewed.openCount }),
                          tone: SEVERITY_TONE[worst],
                      },
                  ],
        action: actionOf(context, category, dossier, standing, reviewed?.openCount ?? 0),
    }
}

/** What the page hands the dossiers tab: what the address has open. */
interface BrainDossiersProps {
    /** The dossier open in the drawer. */
    readonly dossier: string | undefined
    /** The findings of the open dossier and the drawer of its draft, drawn by the page. */
    readonly detail: ReactNode
    readonly draftDrawer: ReactNode
}

/** The dossiers tab of the Second Brain: the figures of the whole set, then the dossiers of each category. */
export const BrainDossiers = (props: BrainDossiersProps) => {
    const t = useTranslations("secondBrain")
    const review = useTranslations("dossierReview")
    const router = navigation.useRouter()
    const member = useWorkspaceMember()
    const slotLabels = useSlotLabels()
    const { categories, slot, reload } = useBrainDossiers()
    const summary = useDossierReviewSummary()
    const context: RowContext = {
        t,
        review,
        reviewOf: summary.reviewOf,
        openId: props.dossier,
        canWrite: member.canWrite,
    }
    const counts = statusCountsOf(
        categories ?? [],
        (dossier) => reviewedStatusOf(dossier.status, summary.reviewOf(dossier.id)).status,
    )
    const figures = [
        ...counts
            .filter(
                (one) =>
                    one.count > 0 || one.status === "present" || one.status === "partial" || one.status === "missing",
            )
            .map((one) => ({ id: one.status, label: t(`status_${one.status}`), value: String(one.count) })),
        { id: "ask", label: t("figureAsk"), value: String(summary.activeCount) },
    ]
    return (
        <BrainDossiersBase
            shape={{ detail: props.dossier === undefined ? null : props.detail, draftDrawer: props.draftDrawer }}
            props={{
                figuresLabel: t("figuresLabel"),
                listFooter: t("dossiersFooter"),
                emptyCategory: t("dossiersEmptyCategory"),
                emptyAll: t("dossiersEmpty"),
                hasDetail: props.dossier !== undefined,
                detailLabel: review("detailLabel"),
                detailCloseLabel: review("detailClose"),
                slot: member.isLoading
                    ? loadingSlot<DossiersContent>()
                    : mapSlot(slot, (rows) => ({
                          figures,
                          categories: rows.map((category) => ({
                              id: category.id,
                              title: category.label,
                              dossiers: category.dossiers.map((dossier) => dossierRowOf(context, category, dossier)),
                          })),
                      })),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("dossiersEmpty")),
            }}
            on={{ retry: reload, closeDetail: () => router.replace(brainTabHref("dossiers")) }}
        />
    )
}
