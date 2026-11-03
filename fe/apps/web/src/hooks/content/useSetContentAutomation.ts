import { useMutateSetContentAutomationSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"
import type { ContentSaveOwner } from "./useContentSave"

/** The trigger of the automation write, whose request and result the command repeats. */
type SetContentAutomationTrigger = ReturnType<typeof useMutateSetContentAutomationSwr>["trigger"]

/** The view `useSetContentAutomation` returns. */
export interface SetContentAutomationView {
    set: (
        request: Parameters<SetContentAutomationTrigger>[0],
        onResult?: (result: Awaited<ReturnType<SetContentAutomationTrigger>> | undefined) => void,
    ) => Promise<Awaited<ReturnType<SetContentAutomationTrigger>> | undefined>
    isPending: boolean
}

/** Saves configuration with its standard feedback, exact cache refresh and origin-owned completion. */
export const useSetContentAutomation = (owner?: ContentSaveOwner): SetContentAutomationView => {
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
