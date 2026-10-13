import useSWRMutation from "swr/mutation"
import { mutateRenameInstallationAgent } from "@/modules/api/graphql/mutations/mutation-rename-installation-agent"
import type { MutateRenameInstallationAgentRequest } from "@/modules/api/graphql/mutations/mutation-rename-installation-agent"

/** What the RenameInstallationAgent mutation is triggered with. */
interface RenameInstallationAgentArg {
    readonly arg: MutateRenameInstallationAgentRequest
}

/** The SWR key of {@link useMutateRenameInstallationAgentSwr}. */
export const MUTATE_RENAME_INSTALLATION_AGENT_SWR_KEY = "MUTATE_RENAME_INSTALLATION_AGENT_SWR"

/** SWR mutation for {@link mutateRenameInstallationAgent}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateRenameInstallationAgentSwr = () =>
    useSWRMutation(
        MUTATE_RENAME_INSTALLATION_AGENT_SWR_KEY,
        async (_key: string, { arg }: RenameInstallationAgentArg) => {
            const result = await mutateRenameInstallationAgent({ request: arg })
            if (!result.data) throw new Error("renameInstallationAgent answered no data")
            return result.data.renameInstallationAgent
        },
    )
