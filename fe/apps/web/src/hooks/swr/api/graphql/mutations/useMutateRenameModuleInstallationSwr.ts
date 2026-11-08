"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRenameModuleInstallation,
    type MutateRenameModuleInstallationRequest,
} from "@/modules/api/graphql/mutations/mutation-rename-module-installation"
import type { RenameModuleInstallationMutation } from "@/modules/api"

/** What the RenameModuleInstallation mutation is triggered with. */
interface RenameModuleInstallationArg {
    readonly arg: MutateRenameModuleInstallationRequest
}

/** The SWR key of {@link useMutateRenameModuleInstallationSwr}. */
export const MUTATE_RENAME_MODULE_INSTALLATION_SWR_KEY = "MUTATE_RENAME_MODULE_INSTALLATION_SWR"

/** SWR mutation for {@link mutateRenameModuleInstallation}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateRenameModuleInstallationSwr = (): SWRMutationResponse<
    RenameModuleInstallationMutation["renameModuleInstallation"],
    Error,
    typeof MUTATE_RENAME_MODULE_INSTALLATION_SWR_KEY,
    RenameModuleInstallationArg["arg"]
> =>
    useSWRMutation(
        MUTATE_RENAME_MODULE_INSTALLATION_SWR_KEY,
        async (_key: string, { arg }: RenameModuleInstallationArg) => {
            const result = await mutateRenameModuleInstallation({ request: arg })
            if (!result.data) throw new Error("renameModuleInstallation answered no data")
            return result.data.renameModuleInstallation
        },
    )
