"use client"

import { useTranslations } from "next-intl"
import { useLeadGenWorkbench } from "@/hooks/leadgen"
import { LeadGenSourcesBase } from "./component"

/** The words of what a source points at: an ad, a form, else a post. */
const REF_KEYS: Readonly<Record<string, string>> = { ad: "refAd", form: "refForm" }

/** What a source points at: an ad, a form or a post. */
interface SourceOrigin {
    readonly refKind?: string | null
    readonly refId?: string | null
    readonly refLabel?: string | null
}

/** The agent the workbench is read for. */
interface LeadGenSourcesProps {
    readonly installationId: string | null
}

/** The sources tab: the words of each row are resolved here. */
export const LeadGenSources = (props: LeadGenSourcesProps) => {
    const t = useTranslations("workbenchLeadGen")
    const { data } = useLeadGenWorkbench(props.installationId)
    const nameOf = (origin: SourceOrigin): string => {
        const { refKind, refId, refLabel } = origin
        if (refLabel) return refLabel
        if (!refKind || !refId) return t("sourceNoRef")
        return t(REF_KEYS[refKind] ?? "refPost", { id: refId })
    }
    if (data === undefined) return null
    return (
        <LeadGenSourcesBase
            props={{
                label: t("sourcesLabel"),
                emptyTitle: t("sourcesEmptyTitle"),
                emptyBody: t("sourcesEmptyBody"),
                rows: (data?.sources ?? []).map((row) => ({
                    key: row.key,
                    name: nameOf(row.origin),
                    counts: t("sourceCounts", { leads: row.leads, hot: row.hot, won: row.won }),
                    sourceLabel: t("sourceBadge", {
                        platform: t(`platform_${row.origin.platform}`),
                        kind: t(`kind_${row.origin.kind}`),
                    }),
                })),
            }}
        />
    )
}
