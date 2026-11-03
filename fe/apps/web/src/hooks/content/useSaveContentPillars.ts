import { useMutateSaveContentPillarsSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"
import type { ContentSaveOwner } from "./useContentSave"

/** The trigger of the pillars write, whose arguments and result the command repeats. */
type SavePillarsTrigger = ReturnType<typeof useMutateSaveContentPillarsSwr>["trigger"]

/** The view `useSaveContentPillars` returns. */
export interface SaveContentPillarsView {
    save: (...args: Parameters<SavePillarsTrigger>) => Promise<Awaited<ReturnType<SavePillarsTrigger>> | undefined>
    isPending: boolean
}

/** Saves configuration with its standard feedback, exact cache refresh and origin-owned completion. */
export const useSaveContentPillars = (owner?: ContentSaveOwner): SaveContentPillarsView => {
    const { trigger } = useMutateSaveContentPillarsSwr()
    const save = useContentSave(trigger, owner)
    return { save: (...args: Parameters<typeof trigger>) => save.exec(args), isPending: save.isPending }
}
