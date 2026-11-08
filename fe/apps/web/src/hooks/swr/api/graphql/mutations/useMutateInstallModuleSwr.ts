"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateInstallModule,
    type MutateInstallModuleRequest,
} from "@/modules/api/graphql/mutations/mutation-install-module"
import type { InstallModuleMutation } from "@/modules/api"

/** What the InstallModule mutation is triggered with. */
interface InstallModuleArg {
    readonly arg: MutateInstallModuleRequest
}

/** The SWR key of {@link useMutateInstallModuleSwr}. */
export const MUTATE_INSTALL_MODULE_SWR_KEY = "MUTATE_INSTALL_MODULE_SWR"

/** SWR mutation for {@link mutateInstallModule}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateInstallModuleSwr = (): SWRMutationResponse<
    InstallModuleMutation["installModule"],
    Error,
    typeof MUTATE_INSTALL_MODULE_SWR_KEY,
    InstallModuleArg["arg"]
> =>
    useSWRMutation(MUTATE_INSTALL_MODULE_SWR_KEY, async (_key: string, { arg }: InstallModuleArg) => {
        const result = await mutateInstallModule({ request: arg })
        if (!result.data) throw new Error("installModule answered no data")
        return result.data.installModule
    })
