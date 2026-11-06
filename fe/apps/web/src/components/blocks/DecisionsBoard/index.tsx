"use client"

import { useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import {
    DECISIONS_LIMIT,
    DECISION_KINDS,
    KIND_KEYS,
    decisionRowViewOf,
    decisionsHref,
    decisionKindOf,
    useDecisionHistory,
} from "@/hooks/decisions"
import { paneGridOf, usePaneCopy, usePanePhone } from "@/hooks/paneFrame"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useQueryAgentsSwr } from "@/hooks/swr"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import type { DecisionKind, DecisionRecord } from "@/modules/types"
import { DecisionsBoardBase } from "./component"
import type { DecisionListView, DecisionsBoardCopy } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

const ALL = "all"

/** The modules the history can be filtered by and the filters it was opened with; the history itself is read here. */
interface DecisionsBoardProps {
    /** The module keys the department filter may offer, from the catalog; only the ones of an installed agent are listed. */
    readonly departments: ReadonlyArray<string>
    readonly kind: DecisionKind | null
    readonly department: string | null
}

/** The translator of the decisions catalog. */
type Translate = ReturnType<typeof useTranslations<"decisions">>

/** The words of the decision history: the page, the states, the filters and the opened decision. */
const copyOf = (t: Translate, pane: ReturnType<typeof usePaneCopy>): DecisionsBoardCopy => ({
    grid: t("gridLabel"),
    title: t("title"),
    pageBody: t("description"),
    listLabel: t("listAria"),
    detailLabel: t("detailLabel"),
    pickTitle: t("pickTitle"),
    pickBody: t("pickBody"),
    emptyTitle: t("emptyTitle"),
    emptyBody: t("emptyBody"),
    noMatchTitle: t("noMatchTitle"),
    noMatchBody: t("noMatchBody"),
    clearFilters: t("clearFilters"),
    errorBody: t("loadFailedBody"),
    back: pane.backToList,
    refresh: pane.refresh,
    openLead: t("openLead"),
    kindLabel: t("kindLabel"),
    deptLabel: t("deptLabel"),
    detail: {
        decisionTitle: t("decisionTitle"),
        whyTitle: t("whyTitle"),
        basisLabel: t("basisLabel"),
        noteLabel: t("noteLabel"),
        noLead: t("noLead"),
        terms: {
            job: t("termJob"),
            department: t("termDepartment"),
            decider: t("termDecider"),
            outcome: t("termOutcome"),
            when: t("termWhen"),
            lead: t("termLead"),
        },
    },
})

/** The decision history: the words and the filter navigation live here, the drawing in the pure half. */
export const DecisionsBoard = (props: DecisionsBoardProps) => {
    const t = useTranslations("decisions")
    const g = useTranslations("governance")
    const pane = usePaneCopy()
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const phone = usePanePhone()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const { slot: history, reload } = useDecisionHistory(props.kind, props.department)
    const [chosen, setChosen] = useState<string | null>(null)
    const installed = new Set((useQueryAgentsSwr({}).data ?? []).map((agent) => agent.module))
    const departments = props.departments.filter((key) => installed.has(key) || key === props.department)
    const isFiltered = props.kind !== null || props.department !== null
    const words = { t, g, format, now: new Date(), workspaceId }
    const listOf = (records: ReadonlyArray<DecisionRecord>): DecisionListView => ({
        rows: records.map((row) => decisionRowViewOf(words, row)),
        count: t(records.length >= DECISIONS_LIMIT ? "countCapped" : "count", { n: records.length }),
        isFiltered,
    })
    const slot = "isEmpty" in history ? mapSlot({ items: [] }, listOf) : mapSlot(history, listOf)
    const rows = "items" in slot ? slot.items.rows : []
    const selectedId = rows.some((row) => row.id === chosen) ? chosen : (rows[0]?.id ?? null)
    return (
        <DecisionsBoardBase
            props={{
                copy: copyOf(t, pane),
                kindKey: props.kind ?? ALL,
                kinds: [
                    { id: ALL, label: t("kindAll") },
                    ...DECISION_KINDS.map((kind) => ({ id: kind, label: t(KIND_KEYS[kind]) })),
                ],
                deptKey: props.department ?? ALL,
                depts: [
                    { id: ALL, label: t("deptAll") },
                    ...departments.map((key) => ({ id: key, label: g(`dept_${key}`) })),
                ],
                slot,
                isWaiting: "isLoading" in slot,
                labels: {
                    ...slotLabels(isFiltered ? t("noMatchTitle") : t("emptyTitle")),
                    error: t("loadFailedTitle"),
                },
                selectedId,
                grid: paneGridOf({ hasList: true, hasAside: false, phone: phone.phone }),
            }}
            on={{
                kind: (key) =>
                    router.push(workspaceHref(workspaceId, decisionsHref(decisionKindOf(key), props.department))),
                dept: (key) =>
                    router.push(
                        workspaceHref(
                            workspaceId,
                            decisionsHref(props.kind, departments.find((module) => module === key) ?? null),
                        ),
                    ),
                clear: () => router.push(workspaceHref(workspaceId, CONSOLE_ROUTES.decisions)),
                retry: reload,
                select: (id) => {
                    setChosen(id)
                    phone.showMain()
                },
                back: phone.showList,
                go: (href) => router.push(href),
            }}
        />
    )
}
