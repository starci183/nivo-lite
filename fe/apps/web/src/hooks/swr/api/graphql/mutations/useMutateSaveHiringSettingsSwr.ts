"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveHiringSettings } from "@/modules/api/graphql/mutations/mutation-save-hiring-settings"
import type { MutateSaveHiringSettingsRequest } from "@/modules/api/graphql/mutations/mutation-save-hiring-settings"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the saveHiringSettings mutation is triggered with. */
interface SaveHiringSettingsArg {
    readonly arg: MutateSaveHiringSettingsRequest
}

/** The SWR key of the `saveHiringSettings` mutation. */
export const MUTATE_SAVE_HIRING_SETTINGS_SWR_KEY = "MUTATE_SAVE_HIRING_SETTINGS_SWR"

/** SWR mutation for {@link mutateSaveHiringSettings}: `trigger(request)` answers `saveHiringSettings` and rejects with the back end failure. */
export const useMutateSaveHiringSettingsSwr = (): SWRMutationResponse<
    OperationData<typeof mutateSaveHiringSettings>["saveHiringSettings"],
    Error,
    typeof MUTATE_SAVE_HIRING_SETTINGS_SWR_KEY,
    SaveHiringSettingsArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_HIRING_SETTINGS_SWR_KEY, async (_key: string, { arg }: SaveHiringSettingsArg) => {
        const result = await mutateSaveHiringSettings({ request: arg })
        if (!result.data) throw new Error("saveHiringSettings answered no data")
        return result.data.saveHiringSettings
    })
