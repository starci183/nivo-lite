"use client"

import { useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import {
    ALL_OWNERS,
    DUES,
    ownerRoleOf,
    ROW_STATUSES,
    rowDueOf,
    rowStatusOf,
    useResponsibilities,
    useResponsibilityActions,
    useResponsibilityFilters,
} from "@/hooks/responsibilities"
import type { DueKey, InitialFilters, RowStatus } from "@/hooks/responsibilities"
import { useAgentPictures } from "@/hooks/installations"
import { paneGridOf, usePaneCopy, usePanePhone } from "@/hooks/paneFrame"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type {
    OwnerGroupView,
    ResponsibilityRowView,
    ResponsibilitiesBoardCopy,
    ResponsibilityOpenedView,
} from "@/modules/types"
import { ResponsibilitiesBoardBase } from "./component"
import type { ResponsibilityChoiceView } from "./component"

const ALL = "all"

/** The filters a link preselected, as checked values. */
interface ResponsibilitiesBoardProps {
    readonly initial: InitialFilters
}

const EMPTY_KEYS: Record<RowStatus | "all", string> = {
    all: "emptyAll",
    open: "emptyOpen",
    waiting_approval: "emptyWaiting",
    done: "emptyDone",
}

const DUE_KEYS: Record<DueKey, string> = {
    any: "anyTime",
    overdue: "dueOverdue",
    today: "dueToday",
    week: "dueWeek",
    none: "noDue",
}

const STATUS_KEYS: Record<RowStatus, string> = {
    open: "statusOpen",
    waiting_approval: "statusWaiting",
    done: "statusDone",
}

/** The translator of the responsibilities catalog. */
type Translate = ReturnType<typeof useTranslations<"responsibilities">>

/** The status tabs with the counts of the read that settled; no count while it waits. */
const tabsOf = (t: Translate, countOf: (key: RowStatus | "all") => string): ReadonlyArray<ResponsibilityChoiceView> => [
    { id: ALL, label: `${t("tabAll")}${countOf("all")}` },
    ...ROW_STATUSES.map((status) => ({ id: status, label: `${t(STATUS_KEYS[status])}${countOf(status)}` })),
]

/** What the words of the board depend on besides the catalog: the time of the read and how many rows it let through. */
interface BoardFacts {
    readonly verified: string
    /** None while the first read waits. */
    readonly count: number | null
}

/** The words of the board: the page, its states, the filters and the opened responsibility. */
const copyOf = (t: Translate, pane: ReturnType<typeof usePaneCopy>, facts: BoardFacts): ResponsibilitiesBoardCopy => ({
    grid: t("pageTitle"),
    title: t("pageTitle"),
    pageBody: t("pageDescription", { time: facts.verified }),
    listLabel: t("byOwner"),
    detailLabel: t("detailLabel"),
    pickTitle: t("pickTitle"),
    pickBody: t("pickBody"),
    errorBody: t("loadFailedBody"),
    emptyBody: t("emptyBody"),
    clearFilters: t("clearFilters"),
    back: pane.backToList,
    moreActions: pane.moreActions,
    filtersLabel: t("filters"),
    filtersTitle: t("filtersTitle"),
    count: facts.count === null ? "" : t(facts.count === 1 ? "countOne" : "countMany", { n: facts.count }),
    tabsLabel: t("tabsLabel"),
    searchLabel: t("searchLabel"),
    searchPlaceholder: t("searchPlaceholder"),
    clearSearch: pane.clearSearch,
    filterSearch: pane.filterSearch,
    filterNoMatch: pane.filterNoMatch,
    draft: t("menuDraft"),
    drafting: t("drafting"),
    menuCopy: t("menuCopy"),
    detail: {
        title: t("detailTitle"),
        verified: t("verified", { time: facts.verified }),
        openLead: t("menuOpenLead"),
        openOffice: t("menuOffice"),
        draftNote: (name: string) => t("draftNote", { name }),
        linkCopied: t("linkCopied"),
        nextOf: (action: string) => t("next", { action }),
        terms: { owner: t("termOwner"), due: t("filterDue"), next: t("termNext"), status: t("termStatus") },
    },
    filters: {
        ownerLabel: t("filterOwner"),
        dueLabel: t("filterDue"),
        sortLabel: t("sortLabel"),
        clear: t("clearFilters"),
        live: t("filtersLive"),
    },
})

/** The responsibility board: the rows are read here, narrowed by the filters and drawn by the pure half. */
export const ResponsibilitiesBoard = (props: ResponsibilitiesBoardProps) => {
    const t = useTranslations("responsibilities")
    const pane = usePaneCopy()
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const phone = usePanePhone()
    const { slot, reload } = useResponsibilities()
    const pictureOf = useAgentPictures()
    const filters = useResponsibilityFilters(("items" in slot ? slot.items : undefined) ?? [], props.initial)
    const actions = useResponsibilityActions()
    const [chosen, setChosen] = useState<string | null>(null)
    const [isFiltersOpen, setFiltersOpen] = useState(false)
    const hasCounts = "items" in slot || "isEmpty" in slot
    const verified = format.dateTime(new Date(), { hour: "2-digit", minute: "2-digit" })
    const openedOf = (group: OwnerGroupView, row: ResponsibilityRowView): ResponsibilityOpenedView => ({
        row,
        avatarUrl: group.kind === "agent" ? pictureOf({ handle: group.handle, name: group.name }) : null,
        ownerRole: ownerRoleOf(t, group),
        dueDate:
            row.dueAt === null
                ? null
                : format.dateTime(new Date(row.dueAt), { day: "2-digit", month: "2-digit", year: "numeric" }),
        canDraft: row.status === "open",
    })
    const opened = filters.groups.flatMap((group) => group.rows.map((row) => openedOf(group, row)))
    const selectedId = opened.some((entry) => entry.row.id === chosen) ? chosen : (opened[0]?.row.id ?? null)
    const countOf = (key: RowStatus | "all"): string => (hasCounts ? ` ${filters.counts[key]}` : "")
    return (
        <ResponsibilitiesBoardBase
            props={{
                copy: copyOf(t, pane, { verified, count: hasCounts ? filters.visibleCount : null }),
                tabs: tabsOf(t, countOf),
                status: filters.status,
                query: filters.query,
                owners: [
                    { id: ALL_OWNERS, label: t("allOwners") },
                    ...filters.owners.map((owner) => ({ id: owner.id, label: owner.name })),
                ],
                owner: filters.owner,
                dues: DUES.map((due) => ({ id: due, label: t(DUE_KEYS[due]) })),
                due: filters.due,
                sorts: [
                    { id: "due", label: t("sortByDue") },
                    { id: "newest", label: t("sortByNewest") },
                ],
                sort: filters.sort,
                isFiltered: filters.isFiltered,
                isFiltersOpen,
                slot: mapSlot("isEmpty" in slot ? { items: [] } : slot, () => ({ rows: opened })),
                isWaiting: "isLoading" in slot,
                labels: {
                    ...slotLabels(filters.isFiltered ? t("emptyFiltered") : t(EMPTY_KEYS[filters.status])),
                    error: t("loadFailedTitle"),
                },
                selectedId,
                draftingId: actions.draftingId,
                copiedId: actions.copiedId,
                grid: paneGridOf({ hasList: true, hasAside: false, phone: phone.phone }),
            }}
            on={{
                status: (key) => filters.setStatus(rowStatusOf(key) ?? "all"),
                query: filters.setQuery,
                owner: (value) => filters.setOwner(value ?? ALL_OWNERS),
                due: (value) => filters.setDue(rowDueOf(value ?? "") ?? "any"),
                sort: (value) => filters.setSort(value === "newest" ? "newest" : "due"),
                clear: filters.clear,
                filtersOpenChange: setFiltersOpen,
                select: (id) => {
                    setChosen(id)
                    phone.showMain()
                },
                back: phone.showList,
                retry: reload,
                draft: actions.draft,
                copy: actions.copy,
                moreFilters: pane.moreFilters,
            }}
        />
    )
}
