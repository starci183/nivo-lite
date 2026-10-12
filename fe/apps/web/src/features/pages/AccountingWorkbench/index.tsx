import { getFormatter, getTranslations } from "next-intl/server"
import { moneyOf } from "@/hooks/accounting"
import { loadAgentDashboard } from "@/lib/agent-dashboard"
import { workbenchHref } from "@/lib/agent-dashboard-shared"
import { listExceptions, listStaff } from "@/lib/flow-queries"
import { getSession } from "@/lib/session"
import { readAccountingWorkbench } from "@/modules/db"
import type { AccountingMeasure, AccountingWorkbenchData } from "@/modules/types"
import { AccountingWorkbenchBase } from "./component"

/** Which tab the route asks for. */
interface AccountingWorkbenchProps {
    /** `?tab=` from the route (overview, evidence, questions, ledger); anything else opens the first tab. */
    readonly tab: string | null
}

type Format = Awaited<ReturnType<typeof getFormatter>>
type Translate = Awaited<ReturnType<typeof getTranslations>>

/** The ribbon: three money figures of this month and the receivable ageing. */
const figuresOf = (data: AccountingWorkbenchData, format: Format, t: Translate) => {
    /** One money figure: live money (never added to simulated), then its count and the simulated part. */
    const moneyItem = (
        id: string,
        term: string,
        measure: AccountingMeasure,
        unit: "countInvoices" | "countPayments",
    ) => ({
        id,
        term,
        description: moneyOf(format, measure.vnd.live),
        meta: [
            t(unit, { n: measure.count.live }),
            measure.count.simulated > 0 ? `${t("originSimulated")}: ${moneyOf(format, measure.vnd.simulated)}` : "",
        ]
            .filter(Boolean)
            .join(" · "),
    })
    const slots = [data.ageing.d0, data.ageing.d30, data.ageing.d60]
    const simulatedOpen = slots.reduce((sum, slot) => sum + slot.vnd.simulated, 0)
    return [
        moneyItem("income", t("mIncome"), data.periods.this.income, "countInvoices"),
        moneyItem("receivable", t("mReceivable"), data.periods.this.receivable, "countInvoices"),
        moneyItem("unmatched", t("mUnmatched"), data.periods.this.unmatched, "countPayments"),
        {
            id: "ageing",
            term: t("mAgeing"),
            description: slots.map((slot) => slot.count.live).join(" / "),
            meta: [
                slots.map((slot) => moneyOf(format, slot.vnd.live)).join(" · "),
                simulatedOpen > 0 ? `${t("originSimulated")}: ${moneyOf(format, simulatedOpen)}` : "",
            ]
                .filter(Boolean)
                .join(" · "),
        },
    ]
}

/** The words that tell why the workbench could not be shown: a refusal is not an outage. */
const failureBodyOf = (outcome: Awaited<ReturnType<typeof readAccountingWorkbench>> | null, t: Translate): string => {
    if (outcome?.kind === "refused") return t("loadRefused")
    return t("loadFailedBody")
}

/** Accounting workbench slot of /agents/accounting/workbench: the agent dashboard frame around the four Accounting surfaces. */
export const AccountingWorkbench = async (props: AccountingWorkbenchProps) => {
    const [t, format, session] = await Promise.all([
        getTranslations("workbenchAccounting"),
        getFormatter(),
        getSession(),
    ])
    // Every waiting accounting item is a "question": a waiting row opens the Questions tab, where the decide UI renders it.
    const dashboard = await loadAgentDashboard("accounting", {
        decisionHref: (item) => workbenchHref("accounting", { tab: "questions", focus: item.id }),
    })
    const [exceptions, staff] = await Promise.all([
        listExceptions().then(
            (items) => ({ ok: true as const, items }),
            () => ({ ok: false as const }),
        ),
        listStaff().catch(() => []),
    ])
    const outcome = exceptions.ok
        ? await readAccountingWorkbench({
              workspaceId: session.workspace.id,
              exceptions: exceptions.items,
              staff,
              ownerName: session.member.displayName,
              role: session.member.role,
          })
        : null
    const data = outcome?.kind === "ok" ? outcome.value : null
    const failureBody = failureBodyOf(outcome, t)
    return (
        <AccountingWorkbenchBase
            props={{
                data,
                dashboard,
                figures: data === null ? [] : figuresOf(data, format, t),
                labels: {
                    overview: t("tabOverview"),
                    evidence: t("tabEvidence"),
                    questions: t("tabQuestions"),
                    ledger: t("tabLedger"),
                    loadFailedTitle: t("loadFailedTitle"),
                    loadFailedBody: failureBody,
                },
                initialTab: props.tab,
                questionsHref: workbenchHref("accounting", { tab: "questions" }),
            }}
        />
    )
}
