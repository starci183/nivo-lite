"use client"

import useSWRMutation from "swr/mutation"
import { mutateCancelOfficeCommand } from "@/modules/api/graphql/mutations/mutation-cancel-office-command"
import type { MutateCancelOfficeCommandRequest } from "@/modules/api/graphql/mutations/mutation-cancel-office-command"

/** What the CancelOfficeCommand mutation is triggered with. */
interface CancelOfficeCommandArg {
    readonly arg: MutateCancelOfficeCommandRequest
}

/** The SWR key of {@link useMutateCancelOfficeCommandSwr}. */
export const MUTATE_CANCEL_OFFICE_COMMAND_SWR_KEY = "MUTATE_CANCEL_OFFICE_COMMAND_SWR"

/** SWR mutation for {@link mutateCancelOfficeCommand}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateCancelOfficeCommandSwr = () =>
    useSWRMutation(MUTATE_CANCEL_OFFICE_COMMAND_SWR_KEY, async (_key: string, { arg }: CancelOfficeCommandArg) => {
        const result = await mutateCancelOfficeCommand({ request: arg })
        if (!result.data) throw new Error("cancelOfficeCommand answered no data")
        return result.data.cancelOfficeCommand
    })
