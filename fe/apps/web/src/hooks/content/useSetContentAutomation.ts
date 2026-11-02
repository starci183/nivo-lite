import { useMutateSetContentAutomationSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"
import type { ContentSaveOwner } from "./useContentSave"

/** Saves configuration with its standard feedback, exact cache refresh and origin-owned completion. */
export const useSetContentAutomation = (owner?: ContentSaveOwner) => {
    const { trigger } = useMutateSetContentAutomationSwr()
    const save = useContentSave(trigger, owner)
    return {
        set: (
            request: Parameters<typeof trigger>[0],
            onResult?: (result: Awaited<ReturnType<typeof trigger>> | undefined) => void,
        ) => save.exec([request], onResult),
        isPending: save.isPending,
    }
}
