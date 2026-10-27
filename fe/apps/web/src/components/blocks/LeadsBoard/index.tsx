"use client"

import { type LeadAgeContext, LeadsBoardBase, type BoardView, type LeadRowView } from "./component"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { ageOf, STAGE_KEYS, STAGE_ORDER, STAGE_TONES, useLeadActions, useLeadBoard } from "@/hooks/leads"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { LEADS_ROUTES, leadPath, newLeadPath } from "@/modules/routes"
import type { LeadListItem, LeadStageId } from "@/modules/types"

const ALL = "all"

/** The leads of the workspace as the page read them, and the search the page was opened with. */
interface LeadsBoardProps {
    readonly initialQuery: string
}

const STAGE_IDS: ReadonlySet<string> = new Set(STAGE_ORDER)
const isStage = (key: string): key is LeadStageId => STAGE_IDS.has(key)

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
    const data = useLeadBoard()
    const actions = useLeadActions()
    const isPending = actions.isPending
    const [nowIso] = useState(() => new Date().toISOString())

    const agoOf = (iso: string): string => leadAgeLabel(iso, { nowIso, t, format })
    const failureOf = (leadId: string): string | null => {
        if (failure?.id === leadId) return failure.text
        return busyId === leadId ? actions.error : null
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
        failure: failureOf(lead.id),
    })
    const slot = mapSlot(data.slot, (leads) => leadBoardViewOf(leads, { query, stage, rowOf, t }))

    const propose = (leadId: string) => {
        setFailure(null)
        setBusyId(leadId)
        void actions.suggestOwner(leadId).then((result) => {
            if (result === undefined) setFailure({ id: leadId, text: t("loadFailedLead") })
        })
    }

    return (
        <LeadsBoardBase
            props={{
                ...buildLeadsBoardView({ slot, query, stage, isPending, busyId, t, slotLabels }),
                pagination: {
                    hasNextPage: data.hasNextPage,
                    isLoading: data.isLoadingMore,
                    failure: data.paginationError === undefined ? null : t("loadMoreFailed"),
                    loadedHint: data.hasNextPage ? t("loadedLeads", { count: data.data?.length ?? 0 }) : null,
                    loadMoreLabel: t("loadMore"),
                    retryLabel: t("retryLoad"),
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
                loadMore: data.loadMore,
                retry: data.retry,
            }}
        />
    )
}

/** The search and display mapping of the loaded lead rows. */
interface LeadBoardRowsContext {
    readonly query: string
    readonly stage: string
    readonly rowOf: (lead: LeadListItem) => LeadRowView
    readonly t: ReturnType<typeof useTranslations<"leads">>
}

const leadBoardViewOf = (leads: ReadonlyArray<LeadListItem>, context: LeadBoardRowsContext): BoardView => {
    const { query, stage, rowOf, t } = context
    const needle = query.trim().toLowerCase()
    const matches = leads.filter(
        (lead) => needle === "" || `${lead.contact_name} ${lead.company} ${lead.need}`.toLowerCase().includes(needle),
    )
    const countOf = (key: string): number =>
        key === ALL ? matches.length : matches.filter((lead) => lead.stage === key).length
    return {
        tabs: [
            { id: ALL, label: t("tabAll", { n: countOf(ALL) }) },
            ...STAGE_ORDER.map((id) => ({ id, label: t("tabStage", { stage: t(STAGE_KEYS[id]), n: countOf(id) }) })),
        ],
        rows: matches.filter((lead) => stage === ALL || lead.stage === stage).map(rowOf),
        hasLeads: leads.length > 0,
        isFiltered: needle !== "" || stage !== ALL,
    }
}

/** Inputs needed to build the LeadsBoardContent section. */
interface BuildLeadsBoardViewContext {
    readonly slot: import("@/modules/types").DataSlot<BoardView>
    readonly query: string
    readonly stage: string
    readonly isPending: boolean
    readonly busyId: string | null
    readonly t: ReturnType<typeof useTranslations<"leads">>
    readonly slotLabels: ReturnType<typeof useSlotLabels>
}
/** Builds the LeadsBoardContent section from the current view. */
const buildLeadsBoardView = ({ slot, query, stage, isPending, busyId, t, slotLabels }: BuildLeadsBoardViewContext) =>
    ({
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
    }) as const

/** Relative age, falling back to a full date for older leads. */
const leadAgeLabel = (iso: string, { nowIso, t, format }: LeadAgeContext): string => {
    const age = ageOf(iso, nowIso)
    if (age.unit === "now") return t("agoJustNow")
    if (age.unit === "minutes") return t("agoMinutes", { n: age.n })
    if (age.unit === "hours") return t("agoHours", { n: age.n })
    if (age.unit === "days") return t("agoDays", { n: age.n })
    return format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })
}
