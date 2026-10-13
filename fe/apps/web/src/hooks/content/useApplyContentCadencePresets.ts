import { useMutateApplyContentCadencePresetsSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"

/** Saves configuration through GraphQL, toasts its outcome and refreshes content data. */
export const useApplyContentCadencePresets = () => {
    const { trigger, isMutating } = useMutateApplyContentCadencePresetsSwr()
    return { apply: useContentSave(() => trigger()), isMutating }
}
