import useSWRMutation from "swr/mutation"
import { mutateRenameModuleInstallation } from "@/modules/api/graphql/mutations/mutation-rename-module-installation"
import type { MutateRenameModuleInstallationRequest } from "@/modules/api/graphql/mutations/mutation-rename-module-installation"

/** What the RenameModuleInstallation mutation is triggered with. */
interface RenameModuleInstallationArg {
    readonly arg: MutateRenameModuleInstallationRequest
}

/** The SWR key of {@link useMutateRenameModuleInstallationSwr}. */
export const MUTATE_RENAME_MODULE_INSTALLATION_SWR_KEY = "MUTATE_RENAME_MODULE_INSTALLATION_SWR"

/** SWR mutation for {@link mutateRenameModuleInstallation}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateRenameModuleInstallationSwr = () =>
    useSWRMutation(
        MUTATE_RENAME_MODULE_INSTALLATION_SWR_KEY,
        async (_key: string, { arg }: RenameModuleInstallationArg) => {
            const result = await mutateRenameModuleInstallation({ request: arg })
            if (!result.data) throw new Error("renameModuleInstallation answered no data")
            return result.data.renameModuleInstallation
        },
    )
