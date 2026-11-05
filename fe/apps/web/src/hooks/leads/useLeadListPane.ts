"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { mapSlot } from "@/hooks/slot"
import type { DataSlot, LeadListItem, LeadListView, LeadRowView } from "@/modules/types"
import { ageOf, channelLabelOf, isStage, STAGE_KEYS, STAGE_ORDER, STAGE_TONES } from "./leads.shared"
import { useLeadBoard } from "./useLeadBoard"

const ALL = "all"

/** Five resting rows: the skeleton keeps the geometry of the ready list. */
const PLACEHOLDER_ROWS: ReadonlyArray<LeadRowView> = ["a", "b", "c", "d", "e"].map((id) => ({
    id,
    name: "",
    company: "",
    line: "",
    owner: "",
    badge: { label: "", tone: "neutral" },
}))

/** The list pane's state and what it reads. */
export interface LeadListPane {
    readonly slot: DataSlot<LeadListView>
    readonly placeholder: LeadListView
    readonly query: string
    readonly stage: string
    readonly pagination: {
        readonly hasNextPage: boolean
        readonly isPending: boolean
        readonly loadMoreError: string | null
        readonly loadedHint: string | null
    }
    readonly setQuery: (value: string) => void
    readonly setStage: (key: string) => void
    readonly clear: () => void
    readonly loadMore: () => void
    readonly retry: () => void
}

/** The tabs of the stage choice: all, then each stage, each with how many leads the search lets through. */
const tabsOf = (
    matches: ReadonlyArray<LeadListItem>,
    t: ReturnType<typeof useTranslations<"leads">>,
): LeadListView["tabs"] => {
    const countOf = (key: string): number =>
        key === ALL ? matches.length : matches.filter((lead) => lead.stage === key).length
    return [
        { value: ALL, label: t("tabAllBare"), count: countOf(ALL) },
        ...STAGE_ORDER.map((id) => ({ value: id, label: t(STAGE_KEYS[id]), count: countOf(id) })),
    ]
}

/** The leads of the workspace through the search and the stage choice, as the list pane draws them. */
export const useLeadListPane = (initialQuery: string): LeadListPane => {
    const t = useTranslations("leads")
    const format = useFormatter()
    const [query, setQuery] = useState(initialQuery)
    const [stage, setStage] = useState<string>(ALL)
    const [nowIso] = useState(() => new Date().toISOString())
    const data = useLeadBoard()

    const agoOf = (iso: string): string => {
        const age = ageOf(iso, nowIso)
        if (age.unit === "now") return t("agoJustNow")
        if (age.unit === "minutes") return t("agoMinutes", { n: age.n })
        if (age.unit === "hours") return t("agoHours", { n: age.n })
        if (age.unit === "days") return t("agoDays", { n: age.n })
        return format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })
    }
    const rowOf = (lead: LeadListItem): LeadRowView => ({
        id: lead.id,
        name: lead.contact_name,
        company: lead.company,
        line: [lead.company, channelLabelOf(lead.channel, t), agoOf(lead.created_at)]
            .filter((part) => part !== "")
            .join(" · "),
        owner: lead.owner_name ?? t("rowNoOwner"),
        badge: { label: t(STAGE_KEYS[lead.stage]), tone: STAGE_TONES[lead.stage] },
    })
    const viewOf = (leads: ReadonlyArray<LeadListItem>): LeadListView => {
        const needle = query.trim().toLowerCase()
        const matches = leads.filter(
            (lead) =>
                needle === "" || `${lead.contact_name} ${lead.company} ${lead.need}`.toLowerCase().includes(needle),
        )
        return {
            tabs: tabsOf(matches, t),
            rows: matches.filter((lead) => stage === ALL || lead.stage === stage).map(rowOf),
            hasLeads: leads.length > 0,
            isFiltered: needle !== "" || stage !== ALL,
        }
    }

    return {
        slot: mapSlot(data.slot, viewOf),
        placeholder: {
            tabs: [
                { value: ALL, label: t("tabAllBare") },
                ...STAGE_ORDER.map((id) => ({ value: id, label: t(STAGE_KEYS[id]) })),
            ],
            rows: PLACEHOLDER_ROWS,
            hasLeads: true,
            isFiltered: false,
        },
        query,
        stage,
        pagination: {
            hasNextPage: data.hasNextPage,
            isPending: data.isLoadingMore,
            loadMoreError: data.paginationError === undefined ? null : t("loadMoreFailed"),
            loadedHint: data.hasNextPage ? t("loadedLeads", { count: data.data?.length ?? 0 }) : null,
        },
        setQuery,
        setStage: (key) => setStage(key === ALL || isStage(key) ? key : ALL),
        clear: () => {
            setQuery("")
            setStage(ALL)
        },
        loadMore: data.loadMore,
        retry: data.retry,
    }
}
