"use client"

import useSWRMutation from "swr/mutation"
import { mutateProposeOfficeCommand } from "@/modules/api/graphql/mutations/mutation-propose-office-command"
import type { MutateProposeOfficeCommandRequest } from "@/modules/api/graphql/mutations/mutation-propose-office-command"

/** What the ProposeOfficeCommand mutation is triggered with. */
interface ProposeOfficeCommandArg {
    readonly arg: MutateProposeOfficeCommandRequest
}

/** The SWR key of {@link useMutateProposeOfficeCommandSwr}. */
export const MUTATE_PROPOSE_OFFICE_COMMAND_SWR_KEY = "MUTATE_PROPOSE_OFFICE_COMMAND_SWR"

/** SWR mutation for {@link mutateProposeOfficeCommand}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateProposeOfficeCommandSwr = () =>
    useSWRMutation(MUTATE_PROPOSE_OFFICE_COMMAND_SWR_KEY, async (_key: string, { arg }: ProposeOfficeCommandArg) => {
        const result = await mutateProposeOfficeCommand({ request: arg })
        if (!result.data) throw new Error("proposeOfficeCommand answered no data")
        return result.data.proposeOfficeCommand
    })
