import type { useTranslations } from "next-intl"
import type { WorkbenchFigureData, SalesConversion, SalesMetrics } from "@/modules/types"
import { SOURCE_KEYS } from "@/hooks/sales"
/** The won share as a whole percent text. */
const percentText = (won: number, leads: number): string => `${Math.round((won / Math.max(1, leads)) * 100)}%`
const MAX_SOURCES_SHOWN = 3
/** The words and formats the figures need, resolved by the caller (a server page or a client block). */
export interface SalesWords {
    readonly t: (key: string, values?: Record<string, string | number>) => string
    readonly money: (amount: number | null) => string
}
const SOURCE_NAMES: ReadonlySet<string> = new Set(SOURCE_KEYS)
const conversionMeta = (conversion: SalesConversion, words: SalesWords): string => {
    if (conversion.leads === 0) return words.t("metricConversionNone", { days: conversion.windowDays })
    const sourceName = (source: string): string => words.t(`source_${SOURCE_NAMES.has(source) ? source : "other"}`)
    const sources = conversion.sources
        .slice(0, MAX_SOURCES_SHOWN)
        .map(
            (source) =>
                `${sourceName(source.source)} ${percentText(source.won, source.leads)} (${source.won}/${source.leads})`,
        )
        .join(" · ")
    return words.t("metricConversionSources", { days: conversion.windowDays, sources })
}
/** The four figures of the Sales ribbon: open deals, the proposal value, won deals and the conversion. */
export const salesFiguresOf = (metrics: SalesMetrics, words: SalesWords): ReadonlyArray<WorkbenchFigureData> => {
    const { t, money } = words
    return [
        { id: "open", term: t("metricOpen"), value: String(metrics.openCount), meta: t("metricOpenBasis") },
        {
            id: "proposal",
            term: t("metricProposal"),
            value: money(metrics.proposalValueVnd),
            meta: t("metricProposalBasis", { n: metrics.proposalCount }),
        },
        {
            id: "won",
            term: t("metricWon"),
            value: String(metrics.wonCount),
            meta:
                metrics.wonValueVnd > 0
                    ? t("metricWonBasis", { value: money(metrics.wonValueVnd) })
                    : t("metricWonNoValue"),
        },
        {
            id: "conversion",
            term: t("metricConversion"),
            value: metrics.conversion.leads === 0 ? "—" : percentText(metrics.conversion.won, metrics.conversion.leads),
            meta: conversionMeta(metrics.conversion, words),
        },
    ]
}
type SalesFiguresPlaceholderOfResult = {
    id: string
    term: string
    value: string
}[]

/** The existing four Sales figure placeholders, with the same localized terms and empty values. */
export const salesFiguresPlaceholderOf = (
    t: ReturnType<typeof useTranslations<"workbenchSales">>,
): SalesFiguresPlaceholderOfResult => [
    { id: "open", term: t("metricOpen"), value: "" },
    { id: "proposal", term: t("metricProposal"), value: "" },
    { id: "won", term: t("metricWon"), value: "" },
    { id: "conversion", term: t("metricConversion"), value: "" },
]
