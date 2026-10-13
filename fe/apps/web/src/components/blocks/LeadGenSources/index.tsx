"use client"

import { useTranslations } from "next-intl"
import type { LeadGenSource } from "@/modules/types"
import { LeadGenSourcesBase } from "./component"

/** The words of what a source points at: an ad, a form, else a post. */
const REF_KEYS: Readonly<Record<string, string>> = { ad: "refAd", form: "refForm" }

/** The sources of the Lead Gen workbench. */
interface LeadGenSourcesProps {
    readonly rows: ReadonlyArray<LeadGenSource>
}

/** The sources tab: the words of each row are resolved here. */
export const LeadGenSources = (props: LeadGenSourcesProps) => {
    const t = useTranslations("workbenchLeadGen")
    const nameOf = (source: LeadGenSource): string => {
        const { refKind, refId, refLabel } = source.origin
        if (refLabel) return refLabel
        if (!refKind || !refId) return t("sourceNoRef")
        return t(REF_KEYS[refKind] ?? "refPost", { id: refId })
    }
    return (
        <LeadGenSourcesBase
            props={{
                label: t("sourcesLabel"),
                emptyTitle: t("sourcesEmptyTitle"),
                emptyBody: t("sourcesEmptyBody"),
                rows: props.rows.map((row) => ({
                    key: row.key,
                    name: nameOf(row),
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
