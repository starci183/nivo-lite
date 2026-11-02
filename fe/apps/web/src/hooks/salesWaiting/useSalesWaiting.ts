"use client"

import { useFormatter, useTranslations } from "next-intl"
import { decisionHref, useSalesActions } from "@/hooks/sales"
import { mapSlot } from "@/hooks/slot"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { agentHref } from "@/modules/installations"
import type { SalesDecision } from "@/modules/types"
import { useGraphQLWithToast } from "@/modules/toast"
import { SALES_WAITING_SHOWN, salesWaitingRowOf } from "./salesWaiting.shared"
import { useSalesWorkbench } from "@/hooks/salesworkbench"

/** The pending decisions of the Sales desk, each decided in place: the oldest three, then a link to the Decisions tab. */
export const useSalesWaiting = (isActive = true, scope?: string) => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const router = navigation.useRouter()
    const { activeWorkspaceId } = useActiveWorkspace()
    const actions = useSalesActions({ isActive, scope: scope ?? activeWorkspaceId ?? "" })
    const runGraphQL = useGraphQLWithToast()
    const workbench = useSalesWorkbench(isActive)
    const pending = workbench.data?.decisions
    const decide = (decision: SalesDecision, outcome: "approved" | "rejected") => {
        const command =
            decision.source === "execution" && decision.executionId !== null
                ? actions.decideDraft({ id: decision.executionId, decision: outcome, editedDraft: undefined })
                : actions.decideWorkItem({ id: decision.id, decision: outcome, edits: undefined })
        command.catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
    }
    const commands = {
        isBusy: actions.isMutating,
        approve: (decision: SalesDecision) => decide(decision, "approved"),
        reject: (decision: SalesDecision) => decide(decision, "rejected"),
        edit: (decision: SalesDecision) => router.push(decisionHref(decision.id)),
    }
    const words = {
        approve: t("waitingApprove"),
        reject: t("waitingReject"),
        edit: t("waitingEdit"),
        needsAnswer: t("kind_clarify"),
        needsDecision: t("kind_decision"),
        incomplete: t("salesDecisionInvalid"),
        reasonReady: t("waitingReason"),
        unknownCustomer: t("waitingUnknownCustomer"),
    }
    const rowsOf = (decisions: ReadonlyArray<SalesDecision>) =>
        decisions.slice(0, SALES_WAITING_SHOWN).map((decision) =>
            salesWaitingRowOf(
                words,
                decision,
                commands,
                decision.amountVnd === null
                    ? null
                    : format.number(decision.amountVnd, {
                          style: "currency",
                          currency: "VND",
                          maximumFractionDigits: 0,
                      }),
            ),
        )
    const hidden = (pending?.length ?? 0) - SALES_WAITING_SHOWN
    return {
        slot: mapSlot(workbench.slot, (data) => rowsOf(data.decisions)),
        count: pending === undefined || pending.length === 0 ? null : String(pending.length),
        more:
            hidden > 0
                ? {
                      label: t("waitingMore", { n: hidden }),
                      href: agentHref("sales", null, "workbench", "tab=decisions"),
                  }
                : null,
        reload: workbench.retry,
    }
}
