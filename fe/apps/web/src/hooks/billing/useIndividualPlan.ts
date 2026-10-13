import { useQueryBillingPlanSwr, useQueryBillingWorkspaceSwr } from "@/hooks/swr"

/** Whether the workspace is on an individual plan (Start, Pro, Max), which takes no other members; false until known. */
export const useIndividualPlan = (workspaceId: string | undefined): boolean => {
    const workspace = useQueryBillingWorkspaceSwr(workspaceId)
    const plan = useQueryBillingPlanSwr(workspaceId === undefined ? undefined : (workspace.data?.planCode ?? undefined))
    return plan.data?.individual === true
}
