"use client"

import useSWRMutation from "swr/mutation"
import { mutateApplyContentPillarPresets } from "@/modules/api/graphql/mutations/mutation-apply-content-pillar-presets"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the applyContentPillarPresets mutation. */
export const MUTATE_APPLY_CONTENT_PILLAR_PRESETS_SWR_KEY = "MUTATE_APPLY_CONTENT_PILLAR_PRESETS_SWR"

/** SWR mutation for {@link mutateApplyContentPillarPresets}: `trigger()` answers the payload and rejects with the back end failure. */
export const useMutateApplyContentPillarPresetsSwr = (): SWRMutationResponse<
    OperationData<typeof mutateApplyContentPillarPresets>["applyContentPillarPresets"],
    Error,
    typeof MUTATE_APPLY_CONTENT_PILLAR_PRESETS_SWR_KEY,
    never
> =>
    useSWRMutation(MUTATE_APPLY_CONTENT_PILLAR_PRESETS_SWR_KEY, async () => {
        const result = await mutateApplyContentPillarPresets()
        if (!result.data) throw new Error("applyContentPillarPresets answered no data")
        return result.data.applyContentPillarPresets
    })
