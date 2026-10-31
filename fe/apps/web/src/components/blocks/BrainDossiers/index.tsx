"use client"

import { useState } from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import type { BadgeTone } from "@starci/grammar/common"
import { DOSSIER_STATUS_TONE, sizeLabelOf, statusCountsOf, useBrainDossiers } from "@/hooks/brain"
import type { CategoryView, DossierView, NumberFormatter } from "@/hooks/brain"
import { useWorkspaceMember, usageViewOf } from "@/hooks/knowledge"
import { loadingSlot, mapSlot, useSlotLabels } from "@/hooks/slot"
import { brainTabHref } from "@/modules/routes"
import { BrainDossiersBase } from "./component"
import type { CategoryRowView, DossierRowView, DossiersContent } from "./component"

type Translate = ReturnType<typeof useTranslations<"secondBrain">>

const placeholderTone: BadgeTone = "neutral"

const placeholderDossier = (id: string): DossierRowView => ({
    id,
    name: "-",
    note: "-",
    status: { label: "-", tone: "neutral" },
    documents: "-",
})

const placeholderCategory = (n: number): CategoryRowView => ({
    id: `placeholder-${n}`,
    label: "-",
    meta: "-",
    title: "-",
    dossiers: [1, 2, 3].map((m) => placeholderDossier(`placeholder-${n}-${m}`)),
})

/** Rows of the same shape as a ready page, drawn as geometry while the categories and dossiers are read. */
const PLACEHOLDER: DossiersContent = {
    categories: [1, 2, 3].map(placeholderCategory),
    counts: [1, 2, 3, 4, 5].map((n) => ({ id: `placeholder-${n}`, label: "-", tone: placeholderTone })),
}

/** The one line of a dossier: what is missing, else what is already held; nothing when the checklist says neither. */
const noteOf = (t: Translate, note: DossierView["note"]): string | null => {
    if (note === null) return null
    return note.kind === "missing" ? t("dossierMissing", { text: note.text }) : note.text
}

/** A dossier in the words of the list: its status, its one line and its documents. */
const dossierRowOf = (t: Translate, dossier: DossierView): DossierRowView => ({
    id: dossier.id,
    name: dossier.name,
    note: noteOf(t, dossier.note),
    status: { label: t(`status_${dossier.status}`), tone: DOSSIER_STATUS_TONE[dossier.status] },
    documents: t("dossierDocuments", { count: dossier.documentCount }),
})

/** A category in the words of the list: its number and name, its documents and size, and its dossiers. */
const categoryRowOf = (t: Translate, format: NumberFormatter, category: CategoryView): CategoryRowView => ({
    id: category.id,
    label: category.order === null ? category.label : `${String(category.order).padStart(2, "0")} ${category.label}`,
    meta: t("categoryMeta", { count: category.documentCount, size: sizeLabelOf(category.sizeBytes, format) }),
    title: category.label,
    dossiers: category.dossiers.map((dossier) => dossierRowOf(t, dossier)),
})

/** The connected dossiers of the Second Brain: the categories of the documents with the allowance meter, and the dossiers of the selected one. */
export const BrainDossiers = () => {
    const t = useTranslations("secondBrain")
    const knowledge = useTranslations("knowledge")
    const locale = useLocale()
    const formatter = useFormatter()
    const format: NumberFormatter = (value, digits) => formatter.number(value, { maximumFractionDigits: digits })
    const member = useWorkspaceMember()
    const slotLabels = useSlotLabels()
    const { categories, slot, reload, usage } = useBrainDossiers()
    const [picked, setPicked] = useState<string | undefined>(undefined)
    const counts = statusCountsOf(categories ?? [])
    const total = counts.reduce((sum, one) => sum + one.count, 0)
    return (
        <BrainDossiersBase
            props={{
                gridLabel: t("dossiersGridLabel"),
                categoriesLabel: t("dossiersCategories"),
                listLabel: t("dossiersList"),
                title: t("dossiersTitle", { count: total }),
                addLabel: t("dossiersAdd"),
                addHref: member.canWrite ? brainTabHref("sources", { add: "base" }) : null,
                emptyCategory: t("dossiersEmptyCategory"),
                emptyAll: t("dossiersEmpty"),
                usage: usageViewOf(knowledge, locale, usage),
                selectedId: picked,
                slot: member.isLoading
                    ? loadingSlot<DossiersContent>()
                    : mapSlot(slot, (rows) => ({
                          categories: rows.map((category) => categoryRowOf(t, format, category)),
                          counts: counts.map((one) => ({
                              id: one.status,
                              label: t("statusCount", { status: t(`status_${one.status}`), count: one.count }),
                              tone: DOSSIER_STATUS_TONE[one.status],
                          })),
                      })),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("dossiersEmpty")),
            }}
            on={{ select: setPicked, retry: reload }}
        />
    )
}
