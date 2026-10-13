import { useMutateApplyContentPillarPresetsSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"

/** Saves configuration through GraphQL, toasts its outcome and refreshes content data. */
export const useApplyContentPillarPresets = () => {
    const { trigger, isMutating } = useMutateApplyContentPillarPresetsSwr()
    return { apply: useContentSave(() => trigger()), isMutating }
}
