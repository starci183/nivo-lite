import useSWRMutation from "swr/mutation"
import { mutateSaveShiftsSettings } from "@/modules/api/graphql/mutations/mutation-save-shifts-settings"
import type { MutateSaveShiftsSettingsRequest } from "@/modules/api/graphql/mutations/mutation-save-shifts-settings"

/** What the saveShiftsSettings mutation is triggered with. */
interface SaveShiftsSettingsArg {
    readonly arg: MutateSaveShiftsSettingsRequest
}

/** The SWR key of the `saveShiftsSettings` mutation. */
export const MUTATE_SAVE_SHIFTS_SETTINGS_SWR_KEY = "MUTATE_SAVE_SHIFTS_SETTINGS_SWR"

/** SWR mutation for {@link mutateSaveShiftsSettings}: `trigger(request)` answers `saveShiftsSettings` and rejects with the back end failure. */
export const useMutateSaveShiftsSettingsSwr = () =>
    useSWRMutation(MUTATE_SAVE_SHIFTS_SETTINGS_SWR_KEY, async (_key: string, { arg }: SaveShiftsSettingsArg) => {
        const result = await mutateSaveShiftsSettings({ request: arg })
        if (!result.data) throw new Error("saveShiftsSettings answered no data")
        return result.data.saveShiftsSettings
    })
