"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import type { PageHeaderContent } from "@starci/grammar/common"
import {
    BRAIN_PANEL_PREFIX,
    categoryIdOf,
    DOSSIER_STATUS_TONE,
    SEVERITY_TONE,
    reviewedStatusOf,
    sizeLabelOf,
    statusCountsOf,
    useBrainDossiers,
    useBrainPageHeader,
    useDossierReviewCommands,
    useDossierReviewSummary,
    worstSeverityOf,
} from "@/hooks/brain"
import type { CategoryView, DossierReviewRecord, DossierView, NumberFormatter } from "@/hooks/brain"
import { useWorkspaceMember, usageViewOf } from "@/hooks/knowledge"
import { loadingSlot, mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { brainDossierHref, brainTabHref } from "@/modules/routes"
import { placeholderDossierRows } from "@/components/composites/DossierRowsCard"
import { BrainDossiersBase } from "./component"
import type { CategoryRowView, DossierRowView, DossiersContent } from "./component"

type Translate = ReturnType<typeof useTranslations<"secondBrain">>
type ReviewTranslate = ReturnType<typeof useTranslations<"dossierReview">>

/** What the review knows when a row is worded: its words, what it computed for the dossier, and which dossier is open. */
interface RowContext {
    readonly t: Translate
    readonly review: ReviewTranslate
    readonly reviewOf: (dossierId: string) => DossierReviewRecord | undefined
    readonly openId: string | undefined
}

const placeholderCategory = (n: number): CategoryRowView => ({
    id: `placeholder-${n}`,
    label: "-",
    meta: "-",
    title: "-",
    dossiers: placeholderDossierRows(`placeholder-${n}`),
})

/** Rows of the same shape as a ready page, drawn as geometry while the categories and dossiers are read. */
const PLACEHOLDER: DossiersContent = {
    categories: [1, 2, 3].map(placeholderCategory),
    counts: [1, 2, 3, 4, 5].map((n) => ({ id: `placeholder-${n}`, label: "-", tone: "neutral" })),
}

/** The one line of a dossier: what is missing, else what is already held; nothing when the checklist says neither. */
const noteOf = (t: Translate, note: DossierView["note"]): string | null => {
    if (note === null) return null
    return note.kind === "missing" ? t("dossierMissing", { text: note.text }) : note.text
}

/**
 * A dossier in the words of the list: the status the review stands at (the checklist's own until it has looked), then the
 * count of its active findings in the tone of the worst, or else its documents; the other count goes into the line.
 */
const dossierRowOf = (context: RowContext, dossier: DossierView): DossierRowView => {
    const { t, review } = context
    const reviewed = context.reviewOf(dossier.id)
    const standing = reviewedStatusOf(dossier.status, reviewed)
    const worst = reviewed === undefined ? null : worstSeverityOf(reviewed)
    const documents = t("dossierDocuments", { count: dossier.documentCount })
    const note = noteOf(t, dossier.note)
    const status = {
        id: "status",
        label: t(`status_${standing.status}`),
        tone: DOSSIER_STATUS_TONE[standing.status],
    }
    return {
        id: dossier.id,
        name: dossier.name,
        href: brainDossierHref(dossier.id),
        isSelected: dossier.id === context.openId,
        note: worst === null ? note : [note, documents].filter((part) => part !== null).join(" · "),
        badges:
            reviewed === undefined || worst === null
                ? [status, { id: "documents", label: documents, tone: "muted" }]
                : [
                      status,
                      {
                          id: "findings",
                          label: review("findingsCount", { count: reviewed.openCount }),
                          tone: SEVERITY_TONE[worst],
                      },
                  ],
    }
}

/** A category in the words of the list: its number and name, its documents and size, and its dossiers. */
const categoryRowOf = (context: RowContext, format: NumberFormatter, category: CategoryView): CategoryRowView => ({
    id: category.id,
    label: category.order === null ? category.label : `${String(category.order).padStart(2, "0")} ${category.label}`,
    meta: context.t("categoryMeta", { count: category.documentCount, size: sizeLabelOf(category.sizeBytes, format) }),
    title: category.label,
    dossiers: category.dossiers.map((dossier) => dossierRowOf(context, dossier)),
})

/** What the page hands the dossiers tab: the header without its tabs, and what the address has open. */
interface BrainDossiersProps {
    readonly header: PageHeaderContent
    /** The dossier open in the detail pane. */
    readonly dossier: string | undefined
    /** The findings of the open dossier and the drawer of its draft, drawn by the page. */
    readonly detail: ReactNode
    readonly draftDrawer: ReactNode
}

/**
 * The dossiers tab of the Second Brain, a panes page of its own: the header with the tabs, the categories of the documents
 * with the allowance meter (a drawer on a phone), and the dossiers of the selected one.
 */
export const BrainDossiers = (props: BrainDossiersProps) => {
    const t = useTranslations("secondBrain")
    const review = useTranslations("dossierReview")
    const knowledge = useTranslations("knowledge")
    const router = navigation.useRouter()
    const locale = useLocale()
    const formatter = useFormatter()
    const format: NumberFormatter = (value, digits) => formatter.number(value, { maximumFractionDigits: digits })
    const member = useWorkspaceMember()
    const slotLabels = useSlotLabels()
    const { categories, slot, reload, usage } = useBrainDossiers()
    const header = useBrainPageHeader("dossiers", props.header)
    const summary = useDossierReviewSummary()
    const commands = useDossierReviewCommands()
    const [picked, setPicked] = useState<string | undefined>(undefined)
    const [isCategoriesOpen, setCategoriesOpen] = useState(false)
    const context: RowContext = { t, review, reviewOf: summary.reviewOf, openId: props.dossier }
    const counts = statusCountsOf(
        categories ?? [],
        (dossier) => reviewedStatusOf(dossier.status, summary.reviewOf(dossier.id)).status,
    )
    const total = counts.reduce((sum, one) => sum + one.count, 0)
    return (
        <BrainDossiersBase
            shape={{ detail: props.dossier === undefined ? null : props.detail, draftDrawer: props.draftDrawer }}
            props={{
                header,
                panelId: `${BRAIN_PANEL_PREFIX}dossiers`,
                gridLabel: t("dossiersGridLabel"),
                categoriesLabel: t("dossiersCategories"),
                categoriesCloseLabel: t("dossiersCategoriesClose"),
                isCategoriesOpen,
                listLabel: t("dossiersList"),
                title: t("dossiersTitle", { count: total }),
                addLabel: t("dossiersAdd"),
                addHref: member.canWrite ? brainTabHref("sources", { add: "base" }) : null,
                emptyCategory: t("dossiersEmptyCategory"),
                emptyAll: t("dossiersEmpty"),
                usage: usageViewOf(knowledge, locale, usage),
                selectedId: picked ?? categoryIdOf(categories ?? [], props.dossier),
                reviewAll: member.canWrite
                    ? {
                          label: review("reviewAll"),
                          isRunning: summary.isRunning,
                          runningLabel: review("reviewRunning"),
                      }
                    : null,
                hasDetail: props.dossier !== undefined,
                detailLabel: review("detailLabel"),
                detailCloseLabel: review("detailClose"),
                slot: member.isLoading
                    ? loadingSlot<DossiersContent>()
                    : mapSlot(slot, (rows) => ({
                          categories: rows.map((category) => categoryRowOf(context, format, category)),
                          counts: counts.map((one) => ({
                              id: one.status,
                              label: t("statusCount", { status: t(`status_${one.status}`), count: one.count }),
                              tone: DOSSIER_STATUS_TONE[one.status],
                          })),
                      })),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("dossiersEmpty")),
            }}
            on={{
                select: (id) => {
                    setPicked(id)
                    setCategoriesOpen(false)
                },
                retry: reload,
                categoriesOpenChange: setCategoriesOpen,
                reviewAll: () => void commands.requestReview(null),
                closeDetail: () => router.replace(brainTabHref("dossiers")),
            }}
        />
    )
}
