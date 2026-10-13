import useSWRMutation from "swr/mutation"
import { mutateApplyContentCadencePresets } from "@/modules/api/graphql/mutations/mutation-apply-content-cadence-presets"

/** The SWR key of the applyContentCadencePresets mutation. */
export const MUTATE_APPLY_CONTENT_CADENCE_PRESETS_SWR_KEY = "MUTATE_APPLY_CONTENT_CADENCE_PRESETS_SWR"

/** SWR mutation for {@link mutateApplyContentCadencePresets}: `trigger()` answers the payload and rejects with the back end failure. */
export const useMutateApplyContentCadencePresetsSwr = () =>
    useSWRMutation(MUTATE_APPLY_CONTENT_CADENCE_PRESETS_SWR_KEY, async () => {
        const result = await mutateApplyContentCadencePresets()
        if (!result.data) throw new Error("applyContentCadencePresets answered no data")
        return result.data.applyContentCadencePresets
    })
