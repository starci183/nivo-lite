import type { useFormatter, useTranslations } from "next-intl"
import { departmentsOf, exceptionChipsOf, exceptionTotalOf, waitingItemsOf } from "@/hooks/overviewGov"
import type { Governance, WaitingWork } from "@/hooks/overviewFigures"
import type { ActivityModel, ResponsibilityRowModel } from "@/hooks/overviewRows"
import { goalLinesOf, statusRowsOf, weekFiguresOf } from "@/hooks/overviewResults"
import { AGENTS_ROUTE, CONSOLE_ROUTES, agentChatHref, leadHref, workspaceHref } from "@/modules/routes"
import type { OnboardingStep } from "@/modules/promo"
import type { AgentLifecycle } from "@/modules/installations"
import type { OverviewPaneReady } from "@/modules/types"

/** How many open responsibilities the work list shows. */
const WORK_LIMIT = 5
/** How many recent events the side pane shows. */
const ACTIVITY_LIMIT = 3

/** One agent of the dashboard with the one state its installation is in. */
export interface PaneAgent {
    readonly id: string
    readonly name: string
    readonly handle: string
    readonly lifecycle: AgentLifecycle
}

/** What the pane is built from: the loaded read, or the empty one that gives the skeleton its shape. */
export interface PaneInput {
    /** The workspace the overview is opened in: every address it draws is inside it. */
    readonly workspaceId: string
    readonly t: ReturnType<typeof useTranslations<"overview">>
    readonly g: ReturnType<typeof useTranslations<"governance">>
    readonly lifecycleOf: (lifecycle: AgentLifecycle) => string
    readonly format: ReturnType<typeof useFormatter>
    readonly now: Date
    readonly pictureOf: (agent: { readonly handle: string; readonly name: string }) => string | null
    readonly title: string
    readonly governance: Governance
    readonly waiting: ReadonlyArray<WaitingWork>
    readonly rows: ReadonlyArray<ResponsibilityRowModel>
    readonly leads: number
    readonly steps: ReadonlyArray<OnboardingStep>
    readonly agents: ReadonlyArray<PaneAgent>
    readonly activity: ReadonlyArray<ActivityModel>
    readonly stamp: string
}

/** The open work, flat: who it is for, who holds it, when it is due and where it stands. */
const workOf = (input: PaneInput): OverviewPaneReady["work"] => {
    const active = input.rows.filter((row) => row.status !== "done")
    return {
        count: input.t("workCount", { n: active.length }),
        empty:
            input.agents.length > 0
                ? {
                      description: input.t("emptyWithAgents"),
                      actionLabel: input.t("emptyActionLead"),
                      href: workspaceHref(input.workspaceId, CONSOLE_ROUTES.newLead),
                  }
                : {
                      description: input.t("emptyNoAgents"),
                      actionLabel: input.t("emptyActionModules"),
                      href: workspaceHref(input.workspaceId, AGENTS_ROUTE),
                  },
        rows: active.slice(0, WORK_LIMIT).map((row) => ({
            id: row.id,
            title: row.title,
            line: `${row.customer} · ${row.ownerName}`,
            ownerName: row.ownerName,
            ownerKind: row.ownerKind,
            ownerKey: row.ownerKey,
            avatarUrl:
                row.ownerHandle === null ? null : input.pictureOf({ handle: row.ownerHandle, name: row.ownerName }),
            due: row.dueLabel,
            isOverdue: row.isOverdue,
            status: { label: row.statusLabel, tone: row.status === "waiting_approval" ? "warning" : "neutral" },
            href: workspaceHref(input.workspaceId, leadHref(row.leadId)),
        })),
    }
}

/** The results by status, with the count of what each rests on under its name. */
const resultsOf = (input: PaneInput): OverviewPaneReady["results"] => {
    const { t, format, governance } = input
    return {
        rows: statusRowsOf(t, format, governance).map((row) => ({
            id: row.id,
            label: row.label,
            count: row.count ?? (row.id === "new" || row.id === "won" ? t("countLeads", { n: row.value }) : null),
            value: row.value,
        })),
        goals: goalLinesOf(t, format, governance),
    }
}

/** The decisions that wait for the owner, each with who asked, why and for how long. */
const waitingOf = (input: PaneInput): OverviewPaneReady["waiting"] => {
    const { g, format, now } = input
    return {
        items: waitingItemsOf(g, input.waiting).map((item) => ({
            id: item.id,
            title: item.title,
            line: [item.department, item.reason, format.relativeTime(new Date(item.createdAt), now)]
                .filter((part) => part !== null)
                .join(" · "),
        })),
    }
}

/** The setup card: how far it is, and the one next step. */
const setupOf = (input: PaneInput): OverviewPaneReady["setup"] => {
    const done = input.steps.filter((step) => step.done).length
    const next = input.steps.find((step) => !step.done) ?? null
    return {
        steps: input.steps,
        progress: `${done}/${input.steps.length}`,
        done,
        next,
        isComplete: input.steps.length > 0 && next === null,
    }
}

/** The pages the head, the cards and the side pane lead to. */
const linksOf = (workspaceId: string): OverviewPaneReady["links"] => ({
    office: workspaceHref(workspaceId, CONSOLE_ROUTES.chat),
    newLead: workspaceHref(workspaceId, CONSOLE_ROUTES.newLead),
    responsibilities: workspaceHref(workspaceId, CONSOLE_ROUTES.responsibilities),
    authority: workspaceHref(workspaceId, CONSOLE_ROUTES.authority),
    decisions: workspaceHref(workspaceId, CONSOLE_ROUTES.decisions),
})

/** Resolves every region of the overview from one loaded read (or from the empty one, for the skeleton). */
export const paneOf = (input: PaneInput): OverviewPaneReady => {
    const { t, governance } = input
    const median = governance.efficiency.medianDecisionMinutes
    const exceptionTotal = exceptionTotalOf(governance)
    return {
        head: { title: input.title, description: t("description", { time: input.stamp }) },
        links: linksOf(input.workspaceId),
        pending: governance.pendingDecisions,
        setup: setupOf(input),
        week: {
            sentence: t("weekSentence", {
                done: governance.efficiency.autoDone7d,
                asked: governance.efficiency.askedHuman7d,
            }),
            median: median === null ? t("sumMedianNone") : t("weekMedian", { n: Math.round(median) }),
            checked: t("verified", { time: input.stamp }),
            figures: weekFiguresOf(input.t, input.rows, input.leads, input.workspaceId),
        },
        work: workOf(input),
        departments: departmentsOf(t, input.g, input.format, governance).map((department) => ({
            id: department.id,
            name: department.name,
            done: department.done,
            waiting: department.waiting,
            last: department.last,
            href: workspaceHref(input.workspaceId, CONSOLE_ROUTES.chat),
        })),
        results: resultsOf(input),
        waiting: waitingOf(input),
        exceptions: {
            total: exceptionTotal === 0 ? null : t("exceptionsTotal", { n: exceptionTotal }),
            chips: exceptionChipsOf(t, input.g, governance),
        },
        agents: input.agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            avatarUrl: input.pictureOf({ handle: agent.handle, name: agent.name }),
            isActive: agent.lifecycle === "running",
            statusLabel: input.lifecycleOf(agent.lifecycle),
            href: workspaceHref(input.workspaceId, agentChatHref(agent.id)),
        })),
        activity: input.activity.slice(0, ACTIVITY_LIMIT).map((item) => ({
            id: item.id,
            kind: item.kind,
            actor: item.actor,
            summary: item.summary,
            time: item.timeLabel,
            href: item.leadId === null ? null : workspaceHref(input.workspaceId, leadHref(item.leadId)),
        })),
    }
}
