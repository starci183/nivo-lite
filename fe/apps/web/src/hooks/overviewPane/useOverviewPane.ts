"use client"

import { useFormatter, useNow, useTranslations } from "next-intl"
import { hourInZone, stampOf } from "@/hooks/overviewRows"
import { useAgentPictures } from "@/hooks/installations"
import type { Governance } from "@/hooks/overviewFigures"
import { MODULE_KEYS, MODULE_REGISTRY } from "@/hooks/moduleCatalog"
import { slotOfSwr } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { DataSlot, OverviewPaneReady } from "@/modules/types"
import { paneOf } from "./overviewPane.shared"
import type { PaneInput } from "./overviewPane.shared"
import {
    firstNameOf,
    greetingOf,
    leadsThisWeek,
    useOverviewData,
    useOverviewGovernance,
    useOverviewRail,
    useOverviewRows,
    useOverviewSteps,
} from "@/hooks/overview"

/** The fixed anatomy of the dashboard before any figure is known: the stable departments and the status roles, no records. */
const EMPTY_GOVERNANCE: Governance = {
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

/** What the overview page reads: the one slot of the dashboard, its skeleton shape and the retry. */
interface OverviewPaneRead {
    readonly slot: DataSlot<OverviewPaneReady>
    readonly placeholder: OverviewPaneReady
    readonly retry: () => undefined
    /** The greeting is known before the dashboard: the name comes from the workspace read. */
    readonly title: string
}

/**
 * The overview from the one dashboard read: every region (setup, the week, open work, agents, results, what waits, agents and
 * activity of the side pane) resolved in the words of the reader. The slot is loading until the dashboard, the agents and
 * their installations are in; a failed dashboard is an error, never an empty overview.
 */
export const useOverviewPane = (): OverviewPaneRead => {
    const t = useTranslations("overview")
    const g = useTranslations("governance")
    const modules = useTranslations("modulesCore")
    const format = useFormatter()
    const now = useNow({ updateInterval: 60_000 })
    const workspaceId = useWorkspaceId()
    const pictureOf = useAgentPictures()
    const { dashboard, failed, retry, displayName } = useOverviewData()
    const gov = useOverviewGovernance()
    const rows = useOverviewRows()
    const steps = useOverviewSteps()
    const rail = useOverviewRail()
    const name = firstNameOf(displayName)
    const title = name === "" ? t("title") : t(greetingOf(hourInZone(now)), { name })
    const base = {
        workspaceId,
        t,
        g,
        lifecycleOf: (lifecycle: Parameters<PaneInput["lifecycleOf"]>[0]) => modules(`lifecycle_${lifecycle}`),
        format,
        now,
        pictureOf,
        title,
        stamp: stampOf(format, now),
    }
    const ready =
        dashboard === undefined || gov === undefined || rows === undefined || steps === undefined || rail === undefined
            ? undefined
            : paneOf({
                  ...base,
                  governance: gov.governance,
                  waiting: gov.waiting,
                  rows: rows.rows,
                  leads: leadsThisWeek(dashboard.leads, rows.now),
                  steps,
                  agents: rail.agents,
                  activity: rail.activity,
              })
    const slot = slotOfSwr({ data: ready, isLoading: !failed, error: failed ? true : undefined })
    return {
        slot,
        placeholder: paneOf({
            ...base,
            governance: EMPTY_GOVERNANCE,
            waiting: [],
            rows: [],
            leads: 0,
            steps: [],
            agents: [],
            activity: [],
        }),
        retry,
        title: failed ? t("title") : title,
    }
}
