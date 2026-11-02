import { useMutateApplyContentCadencePresetsSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"
import type { ContentSaveOwner } from "./useContentSave"

/** Saves configuration with its standard feedback, exact cache refresh and origin-owned completion. */
export const useApplyContentCadencePresets = (owner?: ContentSaveOwner) => {
    const { trigger } = useMutateApplyContentCadencePresetsSwr()
    const save = useContentSave(() => trigger(), owner)
    return { apply: () => save.exec([]), isPending: save.isPending }
}
