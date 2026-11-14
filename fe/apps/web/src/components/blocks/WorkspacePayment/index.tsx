"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useWorkspacePayment, type WorkspacePaymentSelectors } from "@/hooks/billing"
import type { CelebrationFact } from "@/components/composites/CelebrationPanel"
import { AUTH_ROUTES } from "@/modules/routes"
import { WorkspacePaymentBase, type WorkspacePaymentBaseProps } from "./component"

/** The payment URL selectors supplied to the connected block. */
type WorkspacePaymentProps = WorkspacePaymentSelectors

const PAYMENT_WINDOW_MS = 30 * 60 * 1000

const countdown = (left: number) => {
    const seconds = Math.floor(left / 1000)
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

const phaseOf = (state: ReturnType<typeof useWorkspacePayment>): WorkspacePaymentBaseProps["props"]["phase"] => {
    if (state.paid) return "paid"
    if (state.creating) return "creating"
    if (state.loading) return "loading"
    if (!state.workspace) return "missing"
    if (state.error && !state.payment) return "error"
    if (state.expired) return "expired"
    return "pending"
}

/** The facts of a paid order: the plan, the amount, the workspace and the transfer code, each only when known. */
const paidFactsOf = (
    state: ReturnType<typeof useWorkspacePayment>,
    locale: string,
    t: ReturnType<typeof useTranslations<"onboarding">>,
    money: (amount: number) => string,
): ReadonlyArray<CelebrationFact> => {
    const plan = locale === "vi" ? state.plan?.nameVi : state.plan?.nameEn
    const facts: Array<CelebrationFact | undefined> = [
        plan ? { id: "plan", term: t("paidFactPlan"), description: plan } : undefined,
        state.payment ? { id: "amount", term: t("amount"), description: money(state.payment.amountVnd) } : undefined,
        state.workspace ? { id: "workspace", term: t("paidFactWorkspace"), description: state.workspace.name } : undefined,
        state.payment ? { id: "code", term: t("content"), description: state.payment.orderCode } : undefined,
    ]
    return facts.filter((fact): fact is CelebrationFact => fact !== undefined)
}

/** Connects the payment step to workspace, plan, request-progress and order queries. */
export const WorkspacePayment = (props: WorkspacePaymentProps) => {
    const t = useTranslations("onboarding")
    const formatter = useFormatter()
    const locale = useLocale()
    const state = useWorkspacePayment(props)
    const payment = state.payment
    const phase = phaseOf(state)
    return (
        <WorkspacePaymentBase
            props={{
                title: t("payTitle"),
                description: [state.workspace?.name, locale === "vi" ? state.plan?.nameVi : state.plan?.nameEn]
                    .filter(Boolean)
                    .join(" · "),
                crumbLabel: t("crumbLabel"),
                crumbHomeLabel: t("workspacesTitle"),
                crumbHomeHref: AUTH_ROUTES.workspaces,
                phase,
                loadingLabel: t("paymentLoading"),
                creatingLabel: t("paymentCreating"),
                paidTitle: t("paidTitle"),
                paidText: t("paidText"),
                paidBadge: t("paidBadge"),
                paidFactsLabel: t("paidFactsLabel"),
                paidFacts: paidFactsOf(state, locale, t, (amount) =>
                    formatter.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
                ),
                expiredTitle: t("expiredTitle"),
                expiredText: t("expiredText"),
                regenerateLabel: t("regenerate"),
                allWorkspacesLabel: t("allWorkspaces"),
                allWorkspacesHref: AUTH_ROUTES.workspaces,
                openLabel: t("toWorkspace"),
                returnTo: state.returnTo,
                errorTitle: t("errGeneric"),
                missingTitle: t("errWorkspace"),
                error: state.error,
                canRegenerate: state.canRegenerate,
                details: payment
                    ? {
                          title: t("payTitle"),
                          scanTitle: t("scanTitle"),
                          qrAlt: t("qrAlt"),
                          qrUrl: payment.qrUrl,
                          bank: payment.bank,
                          fields: [
                              { id: "pay-bank", label: t("bank"), value: payment.bank.bank },
                              { id: "pay-account", label: t("account"), value: payment.bank.account },
                              { id: "pay-holder", label: t("holder"), value: payment.bank.holder },
                              { id: "pay-content", label: t("content"), value: payment.orderCode },
                          ],
                          copyLabel: t("copy"),
                          copiedLabel: t("copied"),
                          countdownLabel:
                              state.left === undefined ? undefined : t("expiresIn", { time: countdown(state.left) }),
                          countdownProgress:
                              state.left === undefined
                                  ? undefined
                                  : Math.round(Math.min(1, state.left / PAYMENT_WINDOW_MS) * 100),
                          amountLabel: t("amount"),
                          amount: formatter.number(payment.amountVnd, {
                              style: "currency",
                              currency: "VND",
                              maximumFractionDigits: 0,
                          }),
                          contentWarning: t("contentWarn"),
                          waitingLabel: t("waiting"),
                          trustLabel: t("trust"),
                          notConfiguredLabel: t("notConfigured"),
                      }
                    : undefined,
            }}
            on={{ regenerate: state.regenerate }}
        />
    )
}
