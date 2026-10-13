import useSWRMutation from "swr/mutation"
import { mutateConfirmOfficeCommand } from "@/modules/api/graphql/mutations/mutation-confirm-office-command"
import type { MutateConfirmOfficeCommandRequest } from "@/modules/api/graphql/mutations/mutation-confirm-office-command"

/** What the ConfirmOfficeCommand mutation is triggered with. */
interface ConfirmOfficeCommandArg {
    readonly arg: MutateConfirmOfficeCommandRequest
}

/** The SWR key of {@link useMutateConfirmOfficeCommandSwr}. */
export const MUTATE_CONFIRM_OFFICE_COMMAND_SWR_KEY = "MUTATE_CONFIRM_OFFICE_COMMAND_SWR"

/** SWR mutation for {@link mutateConfirmOfficeCommand}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateConfirmOfficeCommandSwr = () =>
    useSWRMutation(MUTATE_CONFIRM_OFFICE_COMMAND_SWR_KEY, async (_key: string, { arg }: ConfirmOfficeCommandArg) => {
        const result = await mutateConfirmOfficeCommand({ request: arg })
        if (!result.data) throw new Error("confirmOfficeCommand answered no data")
        return result.data.confirmOfficeCommand
    })
