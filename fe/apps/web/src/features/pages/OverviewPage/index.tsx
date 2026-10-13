import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { groupByOwner, hourInZone, stamp, toActivityModels, toRowModels } from "@/features/responsibilities/format"
import type { OwnerGroupModel } from "@/features/responsibilities/format"
import { getLocale, getT } from "@/i18n/server"
import { responsibilities as responsibilitiesDictionary } from "@/i18n/dict/responsibilities"
import {
    getGovernance,
    governanceFrom,
    isTestRunName,
    isTestRunWorkItem,
    listExceptions,
    workViewsFrom,
} from "@/lib/flow-queries"
import { getDashboardData } from "@/lib/page-data"
import { listAgents, listRecentEvents, listResponsibilities } from "@/lib/queries"
import { getSession } from "@/lib/session"
import { getPromoState, overviewFactsFrom, readPromoStateFrom, readLeads, readPendingApprovals } from "@/modules/db"
import { CONSOLE_ROUTES, leadHref, responsibilitiesHref } from "@/modules/routes"
import { OverviewPageBase } from "./component"

/** The document title of the overview: the home page name. */
export const overviewMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("shell")
    return { title: t("crumbHome") }
}

/** The result of a read that may fail, kept as a value so the caller decides what a failure means. */
type Attempt<Value> = { readonly ok: true; readonly value: Value } | { readonly ok: false }

const attempt = async <Value,>(read: Promise<Value>): Promise<Attempt<Value>> => {
    try {
        return { ok: true, value: await read }
    } catch {
        return { ok: false }
    }
}

/** The greeting for an hour of the day. */
const greetingOf = (hour: number): "morning" | "afternoon" | "evening" => {
    if (hour < 12) return "morning"
    return hour < 18 ? "afternoon" : "evening"
}

/** How many open rows the overview shows across owners: a glance, not a wall. */
const ROW_LIMIT = 6

/** Keeps the first few open rows across owners. */
const trimGroups = (groups: ReadonlyArray<OwnerGroupModel>): Array<OwnerGroupModel> => {
    let left = ROW_LIMIT
    const kept: Array<OwnerGroupModel> = []
    for (const group of groups) {
        if (left <= 0) break
        const rows = group.rows.slice(0, left)
        left -= rows.length
        kept.push({ ...group, rows })
    }
    return kept
}

/** The overview figures from separate reads, for when the single dashboard request is unavailable. */
const readFacts = async (workspaceId: string, userName: string) => {
    const [leads, pending] = await Promise.all([readLeads(workspaceId), readPendingApprovals(workspaceId)])
    if (leads.kind !== "ok") throw new Error(`overview facts: ${leads.kind} ${leads.code}`)
    if (pending.kind !== "ok") throw new Error(`overview facts: ${pending.kind} ${pending.code}`)
    return overviewFactsFrom(userName, leads.value, pending.value, isTestRunName, {
        list: responsibilitiesHref("status=waiting_approval"),
        lead: leadHref,
    })
}

/** The executive overview: responsibilities, agents, events and real pipeline facts, read once and drawn. */
export const OverviewPage = async () => {
    // ONE request (SQL function dashboard_data) returns every row this view reads; if it is unavailable the separate reads take over.
    const raw = await getDashboardData()
    const session = await getSession()
    const workspaceId = session.workspace.id
    const [allResponsibilities, agents, events, facts, promo, governanceRead, exceptionsRead] = raw
        ? ([
              raw.responsibilities,
              raw.agents,
              raw.events,
              overviewFactsFrom(
                  session.userName,
                  raw.leads,
                  raw.pending.map((row) => ({ leadId: row.lead_id })),
                  isTestRunName,
                  { list: responsibilitiesHref("status=waiting_approval"), lead: leadHref },
              ),
              await readPromoStateFrom(raw.promo),
              await attempt(Promise.resolve().then(() => governanceFrom(raw.governance, raw.since7))),
              await attempt(Promise.resolve(workViewsFrom(raw.exceptions))),
          ] as const)
        : await Promise.all([
              listResponsibilities(),
              listAgents(),
              listRecentEvents(6),
              readFacts(workspaceId, session.userName),
              getPromoState(),
              attempt(getGovernance()),
              attempt(listExceptions()),
          ])
    const governance = governanceRead.ok ? governanceRead.value : null
    const exceptions = exceptionsRead.ok ? exceptionsRead.value : []
    // Test runs (UAT/DBG) are left out of every dashboard figure.
    const responsibilities = allResponsibilities.filter(
        (row) => !isTestRunName(row.lead?.contact_name, row.lead?.company),
    )
    const [t, rt, locale] = await Promise.all([
        getTranslations("overview"),
        getT(responsibilitiesDictionary),
        getLocale(),
    ])
    const now = new Date()
    const hour = hourInZone(now)
    const greeting = greetingOf(hour)
    const rows = toRowModels(responsibilities, agents, now, rt)
    const active = rows.filter((row) => row.status !== "done")
    const verified = stamp(now, locale)
    const countOf = (predicate: (row: (typeof rows)[number]) => boolean) => active.filter(predicate).length
    return (
        <OverviewPageBase
            props={{
                eyebrow: t("eyebrow"),
                title: t(greeting, { name: facts.firstName }),
                description: t("description", { time: verified }),
                openOfficeLabel: t("openOffice"),
                openOfficeHref: CONSOLE_ROUTES.chat,
                newLeadLabel: t("newLead"),
                newLeadHref: CONSOLE_ROUTES.newLead,
                newLeadIsPrimary: (governance?.pendingDecisions ?? 0) === 0,
                governance,
                waiting: exceptions.filter((item) => item.status === "waiting_decision" && !isTestRunWorkItem(item)),
                ownerBelowTitle: t("ownerBelow"),
                kpiLabel: t("kpiAria"),
                kpis: [
                    {
                        id: "open",
                        label: t("kpiOpen"),
                        value: rows.filter((row) => row.status === "open").length,
                        href: responsibilitiesHref("status=open"),
                        isAlert: false,
                    },
                    {
                        id: "waiting",
                        label: t("kpiWaiting"),
                        value: rows.filter((row) => row.status === "waiting_approval").length,
                        href: responsibilitiesHref("status=waiting_approval"),
                        isAlert: true,
                    },
                    {
                        id: "today",
                        label: t("kpiToday"),
                        value: countOf((row) => row.isDueToday),
                        href: responsibilitiesHref("due=today"),
                        isAlert: false,
                    },
                    {
                        id: "overdue",
                        label: t("kpiOverdue"),
                        value: countOf((row) => row.isOverdue),
                        href: responsibilitiesHref("due=overdue"),
                        isAlert: true,
                    },
                    {
                        id: "leads",
                        label: t("kpiLeads"),
                        value: facts.leadsThisWeek,
                        href: CONSOLE_ROUTES.leads,
                        isAlert: false,
                    },
                ],
                byOwnerTitle: t("byOwner"),
                verifiedLabel: t("verified", { time: verified }),
                groups: trimGroups(groupByOwner(active)),
                emptyMessage: t("emptyMessage"),
                emptyDescription: agents.length > 0 ? t("emptyWithAgents") : t("emptyNoAgents"),
                emptyActionLabel: agents.length > 0 ? t("emptyActionLead") : t("emptyActionModules"),
                emptyHref: agents.length > 0 ? CONSOLE_ROUTES.newLead : CONSOLE_ROUTES.modules,
                agents,
                activity: toActivityModels(events, now, rt),
                steps: promo.onboarding,
            }}
        />
    )
}
