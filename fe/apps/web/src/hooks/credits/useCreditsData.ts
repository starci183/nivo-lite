import { useCallback, useEffect } from "react"
import { useQueryBillingWorkspaceSwr } from "@/hooks/swr"
import { useCatalogWithCurrent } from "@/hooks/billing"
import { useQueryCreditPacksSwr } from "@/hooks/swr"
import { useQueryCreditQuotaStatusSwr } from "@/hooks/swr"
import { useQueryCreditTopupLotsSwr } from "@/hooks/swr"
import { useQueryCreditRecentCostUsdSwr } from "@/hooks/swr"
import { useRequireActiveWorkspace } from "@/hooks/workspaces"
import { productCalendarDay } from "@/modules/dayjs"
import { navigation } from "@/modules/i18n"
import { creditsDataOf } from "./credits.shared"
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
    const lots = useQueryCreditTopupLotsSwr(workspaceId, canBuy)
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
            ...(canBuy ? [lots.mutate()] : []),
        ])
    }, [workspace, catalog, packs, quota, recent, lots, canBuy])

    const error = workspace.error || catalog.error || packs.error || quota.error || recent.error || (canBuy && lots.error)
    const workspaceData = workspace.data
    const planData = catalog.plans
    const packData = packs.data
    const quotaData = quota.data
    const recentData = recent.data
    const lotData = lots.data
    let data: CreditsData | null = null
    if (
        workspaceId !== undefined &&
        workspaceData &&
        planData &&
        !catalog.isCurrentLoading &&
        packData &&
        quotaData !== undefined &&
        recentData !== undefined &&
        (!canBuy || lotData !== undefined) &&
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
            lots: canBuy ? (lotData ?? []) : [],
            last7CostUsd: recentData,
            today,
            now,
            contactHref,
        })
    }
    return { data, error, refresh }
}
