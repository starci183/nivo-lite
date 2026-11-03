import { useMutateSaveContentCadenceSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"
import type { ContentSaveOwner } from "./useContentSave"

/** The trigger of the cadence write, whose arguments and result the command repeats. */
type SaveCadenceTrigger = ReturnType<typeof useMutateSaveContentCadenceSwr>["trigger"]

/** The view `useSaveContentCadence` returns. */
export interface SaveContentCadenceView {
    save: (...args: Parameters<SaveCadenceTrigger>) => Promise<Awaited<ReturnType<SaveCadenceTrigger>> | undefined>
    isPending: boolean
}

/** Saves configuration with its standard feedback, exact cache refresh and origin-owned completion. */
export const useSaveContentCadence = (owner?: ContentSaveOwner): SaveContentCadenceView => {
    const { trigger } = useMutateSaveContentCadenceSwr()
    const save = useContentSave(trigger, owner)
    return { save: (...args: Parameters<typeof trigger>) => save.exec(args), isPending: save.isPending }
}
