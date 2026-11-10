"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateCreateAgentInstallation,
    type MutateCreateAgentInstallationRequest,
} from "@/modules/api/graphql/mutations/mutation-create-agent-installation"
import type { SWRMutationResponse } from "swr/mutation"
import type { CreateAgentInstallationMutation } from "@/modules/api"

/** What the CreateAgentInstallation mutation is triggered with. */
interface CreateAgentInstallationArg {
    readonly arg: MutateCreateAgentInstallationRequest
}

/** The SWR key of {@link useMutateCreateAgentInstallationSwr}. */
export const MUTATE_CREATE_AGENT_INSTALLATION_SWR_KEY = "MUTATE_CREATE_AGENT_INSTALLATION_SWR"

/** SWR mutation for {@link mutateCreateAgentInstallation}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateCreateAgentInstallationSwr = (): SWRMutationResponse<
    CreateAgentInstallationMutation["createAgentInstallation"],
    Error,
    typeof MUTATE_CREATE_AGENT_INSTALLATION_SWR_KEY,
    CreateAgentInstallationArg["arg"]
> =>
    useSWRMutation(
        MUTATE_CREATE_AGENT_INSTALLATION_SWR_KEY,
        async (_key: string, { arg }: CreateAgentInstallationArg) => {
            const result = await mutateCreateAgentInstallation({ request: arg })
            if (!result.data) throw new Error("createAgentInstallation answered no data")
            return result.data.createAgentInstallation
        },
    )
