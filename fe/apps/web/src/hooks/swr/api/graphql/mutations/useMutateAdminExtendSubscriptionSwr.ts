"use client"

import useSWRMutation from "swr/mutation"
import { mutateAdminExtendSubscription } from "@/modules/api/graphql/mutations/mutation-admin-extend-subscription"
import type { MutateAdminExtendSubscriptionRequest } from "@/modules/api/graphql/mutations/mutation-admin-extend-subscription"

/** What the admin extend subscription mutation is triggered with. */
interface AdminExtendSubscriptionArg {
    readonly arg: MutateAdminExtendSubscriptionRequest
}

/** The SWR key of the admin extend subscription mutation. */
export const MUTATE_ADMIN_EXTEND_SUBSCRIPTION_SWR_KEY = "MUTATE_ADMIN_EXTEND_SUBSCRIPTION_SWR"

/** SWR mutation for {@link mutateAdminExtendSubscription}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAdminExtendSubscriptionSwr = () =>
    useSWRMutation(
        MUTATE_ADMIN_EXTEND_SUBSCRIPTION_SWR_KEY,
        async (_key: string, { arg }: AdminExtendSubscriptionArg) => {
            const result = await mutateAdminExtendSubscription({ request: arg })
            if (!result.data) throw new Error("adminExtendSubscription answered no data")
            return result.data.adminExtendSubscription
        },
    )
