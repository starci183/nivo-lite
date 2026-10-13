"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { ageOf, STAGE_KEYS, STAGE_ORDER, STAGE_TONES } from "@/hooks/leads"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { writeSuggestOwner } from "@/modules/db/leads/write-lead-actions"
import { LEADS_ROUTES, leadPath, newLeadPath } from "@/modules/routes"
import type { LeadListItem, LeadStageId, DataSlot } from "@/modules/types"
import { LeadsBoardBase } from "./component"
import type { BoardView, LeadRowView } from "./component"

const ALL = "all"

/** The leads of the workspace as the page read them, and the search the page was opened with. */
interface LeadsBoardProps {
    readonly leads: DataSlot<ReadonlyArray<LeadListItem>>
    /** The server clock, so server and browser agree on how long ago a lead arrived. */
    readonly nowIso: string
    readonly initialQuery: string
}

const isStage = (key: string): key is LeadStageId => STAGE_ORDER.some((stage) => stage === key)

/** The Leads list: the search, the stage tabs and the proposal of an owner live here, the drawing in the pure half. */
export const LeadsBoard = (props: LeadsBoardProps) => {
    const t = useTranslations("leads")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const router = navigation.useRouter()
    const [query, setQuery] = useState(props.initialQuery)
    const [stage, setStage] = useState<string>(ALL)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [failure, setFailure] = useState<{ readonly id: string; readonly text: string } | null>(null)
    const [isPending, startTransition] = useTransition()

    const agoOf = (iso: string): string => {
        const age = ageOf(iso, props.nowIso)
        if (age.unit === "now") return t("agoJustNow")
        if (age.unit === "minutes") return t("agoMinutes", { n: age.n })
        if (age.unit === "hours") return t("agoHours", { n: age.n })
        if (age.unit === "days") return t("agoDays", { n: age.n })
        return format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })
    }
    const rowOf = (lead: LeadListItem): LeadRowView => ({
        id: lead.id,
        name: lead.contact_name,
        href: leadPath(lead.id),
        ago: agoOf(lead.created_at),
        subtitle: lead.next_action ? t("rowNext", { next: lead.next_action }) : lead.need,
        who: `${lead.company} · ${lead.owner_name ? t("ownerYou", { name: lead.owner_name }) : t("rowNoOwner")}`,
        stageLabel: t(STAGE_KEYS[lead.stage]),
        stageTone: STAGE_TONES[lead.stage],
        canPropose: lead.owner_name === null,
        failure: failure?.id === lead.id ? failure.text : null,
    })
    const viewOf = (leads: ReadonlyArray<LeadListItem>): BoardView => {
        const needle = query.trim().toLowerCase()
        const matches = leads.filter(
            (lead) =>
                needle === "" || `${lead.contact_name} ${lead.company} ${lead.need}`.toLowerCase().includes(needle),
        )
        const countOf = (key: string): number =>
            key === ALL ? matches.length : matches.filter((lead) => lead.stage === key).length
        return {
            tabs: [
                { id: ALL, label: t("tabAll", { n: countOf(ALL) }) },
                ...STAGE_ORDER.map((id) => ({
                    id,
                    label: t("tabStage", { stage: t(STAGE_KEYS[id]), n: countOf(id) }),
                })),
            ],
            rows: matches.filter((lead) => stage === ALL || lead.stage === stage).map(rowOf),
            hasLeads: leads.length > 0,
            isFiltered: needle !== "" || stage !== ALL,
        }
    }
    const slot = mapSlot(props.leads, viewOf)

    const propose = (leadId: string) => {
        setFailure(null)
        setBusyId(leadId)
        startTransition(async () => {
            const result = await writeSuggestOwner(leadId)
            if (result.kind === "ok") router.refresh()
            else setFailure({ id: leadId, text: result.code })
            setBusyId(null)
        })
    }

    return (
        <LeadsBoardBase
            props={{
                slot,
                query,
                selectedTab: stage,
                isRowBusy: isPending && busyId !== null,
                labels: {
                    searchLabel: t("searchLabel"),
                    searchPlaceholder: t("searchPlaceholder"),
                    clearLabel: t("clearFilters"),
                    tabsLabel: t("tabsLabel"),
                    newLeadLabel: t("newLead"),
                    listAria: t("listAria"),
                    emptyAria: t("emptyAria"),
                    emptyTitle: t("emptyTitle"),
                    emptyBody: t("emptyBody"),
                    noMatchTitle: t("noMatchTitle"),
                    noMatchBody: t("noMatchBody"),
                    openLabel: t("rowOpenLead"),
                    officeLabel: t("rowOffice"),
                    officeHref: LEADS_ROUTES.chat,
                    proposeLabel: t("rowPropose"),
                    moreLabel: t("rowMore"),
                    loadingTabs: [
                        { id: ALL, label: t("tabAllBare") },
                        ...STAGE_ORDER.map((id) => ({ id, label: t(STAGE_KEYS[id]) })),
                    ],
                    slot: slotLabels(t("emptyTitle")),
                },
            }}
            on={{
                query: setQuery,
                clear: () => {
                    setQuery("")
                    setStage(ALL)
                },
                select: (key) => setStage(key === ALL || isStage(key) ? key : ALL),
                openForm: () => router.push(newLeadPath()),
                propose,
            }}
        />
    )
}
