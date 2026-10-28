"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
    ALL_OWNERS,
    DUES,
    ROW_STATUSES,
    rowDueOf,
    rowStatusOf,
    useOwnerGroups,
    useResponsibilities,
    useResponsibilityFilters,
} from "@/hooks/responsibilities"
import type { DueKey, InitialFilters, RowStatus, SortKey } from "@/hooks/responsibilities"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { ResponsibilitiesBoardBase } from "./component"

const ALL = "all"
const SORTS: ReadonlyArray<SortKey> = ["due", "newest"]

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

/** The responsibility board: the rows are read here, narrowed by the filters and drawn by the pure half. */
export const ResponsibilitiesBoard = (props: ResponsibilitiesBoardProps) => {
    const t = useTranslations("responsibilities")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { slot, reload } = useResponsibilities()
    const rows = slot.items ?? []
    const filters = useResponsibilityFilters(rows, props.initial)
    const groups = useOwnerGroups()
    const verified = format.dateTime(new Date(), { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
    const emptyMessage = filters.isFiltered ? t("emptyFiltered") : t(EMPTY_KEYS[filters.status])
    const countOf = (key: RowStatus | "all"): string => (slot.isLoading ? "" : ` (${filters.counts[key]})`)
    return (
        <ResponsibilitiesBoardBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "responsibilities", label: t("pageTitle") },
                ],
                title: t("pageTitle"),
                description: t("pageDescription", { time: verified }),
                newLeadLabel: t("newLead"),
                newLeadHref: CONSOLE_ROUTES.newLead,
                showFilters: filters.showFilters,
                ownerLabel: t("filterOwner"),
                owners: [
                    { id: ALL_OWNERS, label: t("allOwners") },
                    ...filters.owners.map((owner) => ({ id: owner.id, label: owner.name })),
                ],
                owner: filters.owner,
                dueLabel: t("filterDue"),
                dues: DUES.map((due) => ({ id: due, label: t(DUE_KEYS[due]) })),
                due: filters.due,
                clearLabel: t("clearFilters"),
                isFiltered: filters.isFiltered,
                tabsLabel: t("tabsLabel"),
                tabs: responsibilityTabs(t, countOf),
                status: filters.status,
                searchLabel: t("searchLabel"),
                searchPlaceholder: t("searchPlaceholder"),
                query: filters.query,
                filtersLabel: t("filters"),
                sortLabel: t("sortLabel"),
                sorts: responsibilitySorts(t),
                sort: filters.sort,
                listTitle: t("byOwner"),
                count: slot.isLoading ? "" : String(filters.visibleCount),
                verifiedLabel: t("verified", { time: verified }),
                slot: mapSlot(slot, () => filters.groups),
                slotLabels: slotLabels(emptyMessage),
                groupLabels: groups.labels,
                draftingId: groups.draftingId,
                copiedId: groups.copiedId,
            }}
            on={{
                owner: (value) => filters.setOwner(value ?? ALL_OWNERS),
                due: (value) => filters.setDue(rowDueOf(value ?? "") ?? "any"),
                clear: filters.clear,
                status: (key) => filters.setStatus(rowStatusOf(key) ?? "all"),
                query: filters.setQuery,
                toggleFilters: filters.toggleFilters,
                sort: (value) => filters.setSort(SORTS.find((one) => one === value) ?? "due"),
                draft: groups.draft,
                copy: groups.copy,
                retry: reload,
            }}
        />
    )
}

/** Resolves the two supported sort choices. */
const responsibilitySorts = (t: ReturnType<typeof useTranslations<"responsibilities">>) => [
    { id: "due", label: t("sortDue") },
    { id: "newest", label: t("sortNewest") },
]

/** Resolves status tabs and the current row counts. */
const responsibilityTabs = (
    t: ReturnType<typeof useTranslations<"responsibilities">>,
    countOf: (key: RowStatus | "all") => string,
) => [
    { id: ALL, label: `${t("tabAll")}${countOf("all")}` },
    ...ROW_STATUSES.map((status) => ({
        id: status,
        label: `${t(STATUS_KEYS[status])}${countOf(status)}`,
    })),
]
