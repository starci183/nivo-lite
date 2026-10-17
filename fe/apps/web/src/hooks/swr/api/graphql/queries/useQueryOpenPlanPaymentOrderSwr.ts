"use client"

import { argumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryOpenPlanPaymentOrder } from "@/modules/api/graphql/queries/query-open-plan-payment-order"

/** Cache identity of openPlanPaymentOrder. */
export const QUERY_OPEN_PLAN_PAYMENT_ORDER_SWR_KEY = "QUERY_OPEN_PLAN_PAYMENT_ORDER_SWR"

/** Reads the open plan payment order of the selected workspace. */
export const useQueryOpenPlanPaymentOrderSwr = (workspaceId: string | undefined) =>
    useSWR(argumentKey(QUERY_OPEN_PLAN_PAYMENT_ORDER_SWR_KEY, workspaceId), async () => {
        const result = await queryOpenPlanPaymentOrder()
        if (!result.data) throw new Error("openPlanPaymentOrder answered no data")
        return result.data.openPlanPaymentOrder
    })
