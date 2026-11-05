"use client"

import { useFormatter, useTranslations } from "next-intl"
import { DOSSIER_STATUS_TONE, sizeLabelOf, statusCountsOf } from "@/modules/brain"
import type { CategoryView, DossierView, MapDetailView, MapSelection, MapStatusOf } from "@/modules/brain"
import { brainDossierHref, brainTabHref } from "@/modules/routes"

/** The side pane of the map, worded for the selection. */
export interface MapDetail {
    readonly detailOf: (
        categories: ReadonlyArray<CategoryView>,
        selection: MapSelection,
        statusOf: MapStatusOf,
    ) => MapDetailView
}

/** Words and builders of the map's side pane in the active language. */
export const useMapDetail = (): MapDetail => {
    const t = useTranslations("secondBrain")
    const formatter = useFormatter()
    const statusLabelOf = (dossier: DossierView, statusOf: MapStatusOf): string =>
        t(
            statusOf(dossier) === "present" && dossier.documentCount === 0
                ? "statusPresentNoFile"
                : `status_${statusOf(dossier)}`,
        )
    const detailOf: MapDetail["detailOf"] = (categories, selection, statusOf) => {
        if (selection.kind === "category") {
            const { category } = selection
            const size = sizeLabelOf(category.sizeBytes, (value, digits) =>
                formatter.number(value, { maximumFractionDigits: digits }),
            )
            return {
                title:
                    category.order === null
                        ? category.label
                        : `${String(category.order).padStart(2, "0")} ${category.label}`,
                badges: [],
                lines: [t("categoryMeta", { count: category.documentCount, size })],
                rowsLabel: t("mapCategoryRows"),
                rows: category.dossiers.map((dossier) => ({
                    id: dossier.id,
                    label: dossier.name,
                    description: dossier.note === null ? null : dossier.note.text,
                    href: brainTabHref("map", { node: dossier.id }),
                    badge: { label: statusLabelOf(dossier, statusOf), tone: DOSSIER_STATUS_TONE[statusOf(dossier)] },
                })),
                action: null,
            }
        }
        if (selection.kind === "dossier") {
            const { dossier } = selection
            return {
                title: dossier.name,
                badges: [
                    {
                        id: "status",
                        label: statusLabelOf(dossier, statusOf),
                        tone: DOSSIER_STATUS_TONE[statusOf(dossier)],
                    },
                ],
                lines: [
                    ...(dossier.note === null ? [] : [dossier.note.text]),
                    ...(dossier.documentCount > 0 ? [t("dossierDocuments", { count: dossier.documentCount })] : []),
                ],
                rowsLabel: t("mapCategoryRows"),
                rows: [],
                action: { label: t("mapOpenDossier"), href: brainDossierHref(dossier.id) },
            }
        }
        return {
            title: t("mapDetailTitle"),
            badges: [],
            lines: [t("mapDetailHint")],
            rowsLabel: t("mapStatusRows"),
            rows: statusCountsOf(categories, statusOf).map((one) => ({
                id: one.status,
                label: t(`status_${one.status}`),
                description: null,
                href: null,
                badge: { label: String(one.count), tone: DOSSIER_STATUS_TONE[one.status] },
            })),
            action: null,
        }
    }
    return { detailOf }
}
