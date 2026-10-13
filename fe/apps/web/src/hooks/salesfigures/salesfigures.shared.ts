import type { DescriptionListStatItem } from "@starci/grammar/common"
import { SOURCE_KEYS } from "@/hooks/sales"
import type { SalesConversion, SalesMetrics } from "@/modules/types"

/** The won share as a whole percent text. */
const percentText = (won: number, leads: number): string => `${Math.round((won / Math.max(1, leads)) * 100)}%`

const MAX_SOURCES_SHOWN = 3

/** The words and formats the figures need, resolved by the caller (a server page or a client block). */
export interface SalesWords {
    readonly t: (key: string, values?: Record<string, string | number>) => string
    readonly money: (amount: number | null) => string
}

const conversionMeta = (conversion: SalesConversion, words: SalesWords): string => {
    if (conversion.leads === 0) return words.t("metricConversionNone", { days: conversion.windowDays })
    const sourceName = (source: string): string =>
        words.t(`source_${SOURCE_KEYS.some((key) => key === source) ? source : "other"}`)
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
export const salesFiguresOf = (metrics: SalesMetrics, words: SalesWords): ReadonlyArray<DescriptionListStatItem> => {
    const { t, money } = words
    return [
        { id: "open", term: t("metricOpen"), description: String(metrics.openCount), meta: t("metricOpenBasis") },
        {
            id: "proposal",
            term: t("metricProposal"),
            description: money(metrics.proposalValueVnd),
            meta: t("metricProposalBasis", { n: metrics.proposalCount }),
        },
        {
            id: "won",
            term: t("metricWon"),
            description: String(metrics.wonCount),
            meta:
                metrics.wonValueVnd > 0
                    ? t("metricWonBasis", { value: money(metrics.wonValueVnd) })
                    : t("metricWonNoValue"),
        },
        {
            id: "conversion",
            term: t("metricConversion"),
            description:
                metrics.conversion.leads === 0 ? "—" : percentText(metrics.conversion.won, metrics.conversion.leads),
            meta: conversionMeta(metrics.conversion, words),
        },
    ]
}
