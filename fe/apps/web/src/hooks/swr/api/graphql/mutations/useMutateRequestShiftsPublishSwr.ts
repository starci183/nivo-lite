import useSWRMutation from "swr/mutation"
import { mutateRequestShiftsPublish } from "@/modules/api/graphql/mutations/mutation-request-shifts-publish"
import type { MutateRequestShiftsPublishRequest } from "@/modules/api/graphql/mutations/mutation-request-shifts-publish"

/** What the requestShiftsPublish mutation is triggered with. */
interface RequestShiftsPublishArg {
    readonly arg: MutateRequestShiftsPublishRequest
}

/** The SWR key of the `requestShiftsPublish` mutation. */
export const MUTATE_REQUEST_SHIFTS_PUBLISH_SWR_KEY = "MUTATE_REQUEST_SHIFTS_PUBLISH_SWR"

/** SWR mutation for {@link mutateRequestShiftsPublish}: `trigger(request)` answers `requestShiftsPublish` and rejects with the back end failure. */
export const useMutateRequestShiftsPublishSwr = () =>
    useSWRMutation(MUTATE_REQUEST_SHIFTS_PUBLISH_SWR_KEY, async (_key: string, { arg }: RequestShiftsPublishArg) => {
        const result = await mutateRequestShiftsPublish({ request: arg })
        if (!result.data) throw new Error("requestShiftsPublish answered no data")
        return result.data.requestShiftsPublish
    })
