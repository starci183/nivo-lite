"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { TODO_FILTERS, TODO_SEVERITY_FILTERS, queryOfTodo, useDossierFindings, useFindingRows } from "@/hooks/brain"
import type { FindingAction, FindingRowView, TodoFilter, TodoSeverityFilter } from "@/hooks/brain"
import { navigation } from "@/modules/i18n"
import { brainDossierHref } from "@/modules/routes"
import { DossierTodoBase } from "./component"

const PLACEHOLDER_ROW: FindingRowView = {
    id: "placeholder",
    title: "-",
    titleHref: null,
    detail: "-",
    badges: [{ id: "severity", label: "-", tone: "neutral" }],
    meta: null,
    isFocused: false,
    evidenceTitle: "-",
    evidence: [],
    sources: [],
    actions: [],
}

/** Rows of the same shape as a ready list, drawn as geometry while the findings are read. */
const PLACEHOLDER: ReadonlyArray<FindingRowView> = [1, 2, 3].map((n) => ({
    ...PLACEHOLDER_ROW,
    id: `placeholder-${n}`,
}))

/** The words of the segment of each filter. */
const FILTER_KEY = {
    all: "filterAll",
    mine: "filterMine",
    unassigned: "filterUnassigned",
    drafts: "filterDrafts",
} as const

/** The words of the choice of each severity; "all" is the same word as the first filter. */
const SEVERITY_KEY = {
    all: "filterAll",
    critical: "severity_critical",
    high: "severity_high",
    medium: "severity_medium",
    low: "severity_low",
} as const

/** The connected list of what needs doing across the dossiers: open and confirmed findings, with a way to the dossier of each. */
export const DossierTodo = () => {
    const t = useTranslations("dossierReview")
    const router = navigation.useRouter()
    const slotLabels = useSlotLabels()
    const [filter, setFilter] = useState<TodoFilter>("all")
    const [severity, setSeverity] = useState<TodoSeverityFilter>("all")
    const list = useDossierFindings(queryOfTodo(filter, severity))
    const { rowOf } = useFindingRows()
    const labels = slotLabels(t("emptyTodo"))
    const act = (findingId: string, action: FindingAction) => {
        const finding = list.slot.items?.find((one) => one.id === findingId)
        if (action !== "viewDraft" || !finding?.dossierId || !finding.draftId) return
        router.replace(brainDossierHref(finding.dossierId, { finding: finding.id, draft: finding.draftId }))
    }
    return (
        <DossierTodoBase
            props={{
                title: t("tabTodo"),
                filterLabel: t("filterLabel"),
                filters: TODO_FILTERS.map((one) => ({ value: one, label: t(FILTER_KEY[one]) })),
                filter,
                severityLabel: t("severityFilter"),
                severities: TODO_SEVERITY_FILTERS.map((one) => ({ id: one, label: t(SEVERITY_KEY[one]) })),
                severity,
                listLabel: t("todoLabel"),
                slot: mapSlot(list.slot, (all) =>
                    all.map((one) =>
                        rowOf(one, {
                            members: list.members,
                            canWrite: false,
                            focusedId: undefined,
                            showDossier: true,
                            upload: null,
                        }),
                    ),
                ),
                placeholder: PLACEHOLDER,
                slotLabels: labels,
                hasNextPage: list.hasNextPage,
                isLoadingMore: list.isLoadingMore,
                loadMoreLabel: t("loadMore"),
                pageFailure: list.hasPageFailure ? labels.error : null,
            }}
            on={{
                setFilter: (value) => setFilter(TODO_FILTERS.find((one) => one === value) ?? filter),
                setSeverity: (value) => setSeverity(TODO_SEVERITY_FILTERS.find((one) => one === value) ?? severity),
                action: act,
                loadMore: list.loadMore,
                retry: list.retry,
            }}
        />
    )
}
