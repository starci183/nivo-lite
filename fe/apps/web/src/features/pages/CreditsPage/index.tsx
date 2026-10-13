import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { creditsDataOf } from "@/hooks/credits/credits.shared"
import { TIME_ZONE } from "@/i18n/core"
import { bankAccount } from "@/lib/sepay"
import { getSession } from "@/lib/session"
import {
    readBillingWorkspace,
    readCreditPacks,
    readPaymentOrders,
    readPlans,
    readQuotaStatus,
    readRecentCostUsd,
    readTopupLots,
} from "@/modules/db"
import { CreditsPageBase } from "./component"

/** The document title of the page. */
export const creditsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("credits")
    return { title: t("title") }
}

/** Where "contact NIVO" goes: NIVO_CONTACT_URL (a mailto: or a page) when set, else the public site. */
const contactHref = (): string => process.env.NIVO_CONTACT_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://nivo.vn"

const DAY_MS = 86_400_000
const LAST_DAYS = 6

/**
 * "Credits and plan": this month's credits, top-up packs, upgrade and payment history. A workspace that is not paid yet (waiting for
 * its first payment, or cancelled) keeps the plain billing page under /workspaces/<id>/billing. Every read runs under RLS.
 */
export const CreditsPage = async () => {
    const session = await getSession()
    const workspaceId = session.workspace.id
    const now = new Date()
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now)
    const since = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
        new Date(now.getTime() - LAST_DAYS * DAY_MS),
    )
    const canBuy = session.member.role === "owner" || session.member.role === "manager"
    const [workspace, plans, packs, status, orders, lots, recent] = await Promise.all([
        readBillingWorkspace(session.userId, workspaceId),
        readPlans(),
        readCreditPacks(),
        readQuotaStatus(workspaceId),
        readPaymentOrders(workspaceId),
        canBuy ? readTopupLots(workspaceId) : Promise.resolve({ kind: "ok", value: [] } as const),
        readRecentCostUsd(workspaceId, since),
    ])
    if (workspace.kind !== "ok") throw new Error(`credits: workspace ${workspace.kind} ${workspace.code}`)
    if (plans.kind !== "ok") throw new Error(`credits: plans ${plans.kind} ${plans.code}`)
    if (packs.kind !== "ok") throw new Error(`credits: packs ${packs.kind} ${packs.code}`)
    if (orders.kind !== "ok") throw new Error(`credits: orders ${orders.kind} ${orders.code}`)
    if (lots.kind !== "ok") throw new Error(`credits: lots ${lots.kind} ${lots.code}`)
    if (workspace.value.status === "pending_payment" || workspace.value.status === "cancelled") {
        redirect(`/workspaces/${workspaceId}/billing`)
    }
    const data = creditsDataOf({
        workspaceId,
        canBuy,
        workspace: workspace.value,
        plans: plans.value,
        packs: packs.value,
        status: status.kind === "ok" ? status.value : null,
        orders: orders.value,
        lots: lots.value,
        last7CostUsd: recent.kind === "ok" ? recent.value : 0,
        today,
        now,
        bank: bankAccount(),
        contactHref: contactHref(),
    })
    return <CreditsPageBase data={data} />
}

/** The same page while its data loads: real labels, placeholder figures and rows. */
export const CreditsLoadingPage = () => <CreditsPageBase data={null} />
