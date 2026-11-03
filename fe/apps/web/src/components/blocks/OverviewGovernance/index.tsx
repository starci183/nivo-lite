"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
    TOP_WAITING,
    departmentsOf,
    exceptionChipsOf,
    exceptionTotalOf,
    historyRowsOf,
    waitingItemsOf,
} from "@/hooks/overviewGov"
import { useOverviewData, useOverviewGovernance } from "@/hooks/overview"
import { goalLinesOf, statusRowsOf } from "@/hooks/overviewResults"
import type { Governance } from "@/hooks/overviewFigures"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { MODULE_KEYS, MODULE_REGISTRY } from "@/hooks/moduleCatalog"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { OverviewGovernanceBase } from "./component"
import type { OverviewGovernanceFigures } from "./component"

type Translate<N extends "overview" | "governance"> = ReturnType<typeof useTranslations<N>>

/** The loaded governance read and the translators and formatter its words come through. */
interface FiguresInput {
    readonly t: Translate<"overview">
    readonly g: Translate<"governance">
    readonly format: ReturnType<typeof useFormatter>
    readonly data: NonNullable<ReturnType<typeof useOverviewGovernance>>
}

/** Resolves every block of the governance section from the loaded read. */
const figuresOf = ({ t, g, format, data }: FiguresInput): OverviewGovernanceFigures => {
    const { governance } = data
    const pending = governance.pendingDecisions
    const exceptionTotal = exceptionTotalOf(governance)
    const excluded = governance.status.excludedTestRecords
    return {
        summary: {
            title: t("sumTitle"),
            motto: t("motto"),
            sentence: t("sumSentence", {
                done: governance.efficiency.autoDone7d,
                asked: governance.efficiency.askedHuman7d,
            }),
            median:
                governance.efficiency.medianDecisionMinutes === null
                    ? t("sumMedianNone")
                    : t("sumMedian", { n: Math.round(governance.efficiency.medianDecisionMinutes) }),
            chatHref: CONSOLE_ROUTES.chat,
            departments: departmentsOf(t, g, format, governance),
        },
        results: {
            title: t("resultsTitle"),
            intro: t("resultsIntro"),
            rows: statusRowsOf(t, format, governance),
            service: t("resultsService"),
            goals: goalLinesOf(t, format, governance),
            goalHref: CONSOLE_ROUTES.authority,
            goalSetLabel: t("goalSet"),
            testNote: excluded > 0 ? t("resultsTestExcluded", { n: format.number(excluded) }) : t("resultsTestNone"),
        },
        waiting: {
            title: t("waitingTitle"),
            openLabel: pending > 0 ? t("waitingOpen") : null,
            chatHref: CONSOLE_ROUTES.chat,
            none: t("waitingNone"),
            count: pending === 1 ? t("waitingCountOne") : t("waitingCount", { n: pending }),
            items: pending === 0 ? [] : waitingItemsOf(g, data.waiting),
            more: pending > TOP_WAITING ? t("waitingMore", { n: pending }) : null,
            source: t("waitingSource"),
        },
        exceptions: {
            title: t("exceptionsTitle"),
            none: t("exceptionsNone"),
            total: exceptionTotal === 0 ? null : t("exceptionsTotal", { n: exceptionTotal }),
            chips: exceptionChipsOf(t, g, governance),
            source: t("exceptionsSource"),
        },
        history: {
            title: t("historyTitle"),
            allLabel: t("historyAll"),
            allHref: CONSOLE_ROUTES.decisions,
            empty: t("historyEmpty"),
            rows: historyRowsOf(g, format, governance),
            source: t("historySource"),
        },
    }
}

/** The fixed dashboard anatomy: known departments and status roles, with unknown collections left to Grammar's loading rows. */
const GOVERNANCE_PLACEHOLDER: Governance = {
    goals: { revenueVnd: null, newCustomers: null, firstReplyMinutes: null },
    results: {
        confirmedVnd: 0,
        invoicedVnd: 0,
        collectedVnd: 0,
        ordersConfirmed: 0,
        newCustomers7d: 0,
        wonCustomers: 0,
    },
    status: {
        confirmedOrders: { vnd: 0, count: 0 },
        internalInvoices: { vnd: 0, count: 0 },
        matchedPayments: { vnd: 0, count: 0 },
        pendingVerification: { vnd: 0, count: 0 },
        newLeads7d: 0,
        wonLeads: 0,
        excludedTestRecords: 0,
    },
    efficiency: { autoDone7d: 0, askedHuman7d: 0, medianDecisionMinutes: null },
    pendingDecisions: 0,
    exceptions: { routine: 0, missing_data: 0, over_authority: 0, unclear_outcome: 0, not_allowed: 0, failed: 0 },
    departments: MODULE_KEYS.filter((key) => MODULE_REGISTRY[key].status === "stable").map((department) => ({
        department,
        done7d: 0,
        waiting: 0,
        lastActivityAt: null,
    })),
    recentDecisions: [],
}

/** The five governance blocks of the overview with their copy and figures resolved in the browser. */
export const OverviewGovernance = () => {
    const t = useTranslations("overview")
    const g = useTranslations("governance")
    const format = useFormatter()
    const data = useOverviewGovernance()
    const { failed, retry } = useOverviewData()
    const labels = useSlotLabels()
    const slot = mapSlot(
        slotOfSwr({ data, isLoading: data === undefined && !failed, error: failed ? true : undefined }),
        (ready) => figuresOf({ t, g, format, data: ready }),
    )
    return (
        <OverviewGovernanceBase
            props={{
                slot,
                slotLabels: labels(t("govUnavailable")),
                placeholder: figuresOf({ t, g, format, data: { governance: GOVERNANCE_PLACEHOLDER, waiting: [] } }),
            }}
            on={{ retry }}
        />
    )
}
