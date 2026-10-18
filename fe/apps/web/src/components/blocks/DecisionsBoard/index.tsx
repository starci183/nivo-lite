"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
    DECISIONS_LIMIT,
    DECISION_KINDS,
    KIND_KEYS,
    decisionsHref,
    decisionKindOf,
    outcomeTone,
    splitBasis,
    useDecisionHistory,
} from "@/hooks/decisions"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, leadHref } from "@/modules/routes"
import type { DecisionKind, DecisionRecord } from "@/modules/types"
import { DecisionsBoardBase, type DecisionListView, type DecisionsBoardRowView } from "./component"

const ALL = "all"

/** The modules the history can be filtered by and the filters it was opened with; the history itself is read here. */
interface DecisionsBoardProps {
    /** The module keys the department tabs offer, from the catalog. */
    readonly departments: ReadonlyArray<string>
    readonly kind: DecisionKind | null
    readonly department: string | null
}

const PLACEHOLDER: DecisionListView = { rows: [], count: "", isFiltered: false }

/** The decision history: the words and the filter navigation live here, the drawing in the pure half. */
export const DecisionsBoard = (props: DecisionsBoardProps) => {
    const t = useTranslations("decisions")
    const g = useTranslations("governance")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const { slot: history, reload } = useDecisionHistory(props.kind, props.department)
    const router = navigation.useRouter()
    const isFiltered = props.kind !== null || props.department !== null
    const rowOf = (row: DecisionRecord): DecisionsBoardRowView => {
        const parts = splitBasis(row.note)
        return {
            id: row.id,
            actionLabel: g(`action_${row.action}`),
            outcomeLabel: g(`outcome_${row.outcome}`),
            outcomeTone: outcomeTone(row.outcome),
            when: format.dateTime(new Date(row.created_at), { dateStyle: "short", timeStyle: "short" }),
            departmentLabel: g(`dept_${row.department}`),
            decider: row.decider_kind === "policy" ? g("decider_policy") : row.decided_by,
            reason:
                row.reason === null || row.reason === "routine"
                    ? null
                    : `${g("reason_" + row.reason)} - ${g("reasonHint_" + row.reason)}`,
            basis: parts.basis === null ? null : t("basis", { basis: parts.basis }),
            note: parts.rest === null ? null : t("note", { note: parts.rest }),
            leadHref: row.lead_id === null ? null : leadHref(row.lead_id),
            leadLabel: `${row.leadName ?? t("openLead")} →`,
            noLead: t("noLead"),
        }
    }
    const listOf = (records: ReadonlyArray<DecisionRecord>): DecisionListView => ({
        rows: records.map(rowOf),
        count: t(records.length >= DECISIONS_LIMIT ? "countCapped" : "count", { n: records.length }),
        isFiltered,
    })
    return (
        <DecisionsBoardBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "decisions", label: t("title") },
                ],
                eyebrow: t("eyebrow"),
                title: t("title"),
                description: t("description"),
                kindLabel: t("kindLabel"),
                kindKey: props.kind ?? ALL,
                kinds: [
                    { id: ALL, label: t("kindAll") },
                    ...DECISION_KINDS.map((kind) => ({ id: kind, label: t(KIND_KEYS[kind]) })),
                ],
                deptLabel: t("deptLabel"),
                deptKey: props.department ?? ALL,
                depts: [
                    { id: ALL, label: t("deptAll") },
                    ...props.departments.map((key) => ({ id: key, label: g(`dept_${key}`) })),
                ],
                listAria: t("listAria"),
                slot: mapSlot(history, listOf),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(isFiltered ? t("noMatchTitle") : t("emptyTitle")),
                noMatchTitle: t("noMatchTitle"),
                noMatchBody: t("noMatchBody"),
                emptyTitle: t("emptyTitle"),
                emptyBody: t("emptyBody"),
                clearFilters: t("clearFilters"),
            }}
            on={{
                kind: (key) => router.push(decisionsHref(decisionKindOf(key), props.department)),
                dept: (key) =>
                    router.push(decisionsHref(props.kind, props.departments.find((module) => module === key) ?? null)),
                clear: () => router.push(CONSOLE_ROUTES.decisions),
                retry: reload,
            }}
        />
    )
}
