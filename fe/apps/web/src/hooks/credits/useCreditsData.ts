"use client"

import { useCallback, useEffect } from "react"
import {
    useQueryBillingWorkspaceSwr,
    useQueryCreditPacksSwr,
    useQueryCreditQuotaStatusSwr,
    useQueryCreditRecentCostUsdSwr,
} from "@/hooks/swr"
import { useCatalogWithCurrent } from "@/hooks/billing"

import { useRequireActiveWorkspace } from "@/hooks/workspaces"
import { productCalendarDay } from "@/modules/dayjs"
import { navigation } from "@/modules/i18n"
import { creditsDataOf } from "./credits.shared"
import { useCreditsLedger } from "./useCreditsLedger"
import type { CreditsData } from "@/modules/types"
import { workspaceBillingPath } from "@/modules/routes"

const LAST_DAYS = 6

/** Connects the credits overview to the catalogue and selected workspace. */
export const useCreditsData = (contactHref: string) => {
    const { activeWorkspaceId: workspaceId } = useRequireActiveWorkspace()
    const router = navigation.useRouter()
    const now = new Date()
    const today = productCalendarDay(now)
    const since = productCalendarDay(now, -LAST_DAYS)
    const workspace = useQueryBillingWorkspaceSwr(workspaceId)
    const catalog = useCatalogWithCurrent(workspace.data?.planCode)
    const packs = useQueryCreditPacksSwr()
    const quota = useQueryCreditQuotaStatusSwr(workspaceId)
    const canBuy = workspace.data?.role === "owner" || workspace.data?.role === "manager"
    const ledger = useCreditsLedger(workspaceId, canBuy)
    const recent = useQueryCreditRecentCostUsdSwr(workspaceId, since)
    const isUnpaid = workspace.data?.status === "pending_payment" || workspace.data?.status === "cancelled"

    useEffect(() => {
        if (workspaceId && isUnpaid) router.replace(workspaceBillingPath(workspaceId))
    }, [workspaceId, isUnpaid, router])

    const refresh = useCallback(async () => {
        await Promise.all([
            workspace.mutate(),
            catalog.refresh(),
            packs.mutate(),
            quota.mutate(),
            recent.mutate(),
            ledger.refresh(),
        ])
    }, [workspace, catalog, packs, quota, recent, ledger])

    const error = workspace.error || catalog.error || packs.error || quota.error || recent.error || ledger.error
    const workspaceData = workspace.data
    const planData = catalog.plans
    const packData = packs.data
    const quotaData = quota.data
    const recentData = recent.data
    let data: CreditsData | null = null
    if (
        workspaceId !== undefined &&
        workspaceData &&
        planData &&
        !catalog.isCurrentLoading &&
        packData &&
        quotaData !== undefined &&
        recentData !== undefined &&
        ledger.isReady &&
        !isUnpaid
    ) {
        data = creditsDataOf({
            workspaceId,
            canBuy,
            workspace: workspaceData,
            plans: planData,
            current: catalog.current ?? null,
            packs: packData,
            status: quotaData,
            lots: canBuy ? (ledger.lots ?? []) : [],
            bought: ledger.bought ?? [],
            last7CostUsd: recentData,
            today,
            now,
            contactHref,
        })
    }
    return { data, error, refresh }
}
