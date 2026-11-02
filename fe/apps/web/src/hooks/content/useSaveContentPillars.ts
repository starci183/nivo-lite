import { useMutateSaveContentPillarsSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"
import type { ContentSaveOwner } from "./useContentSave"

/** Saves configuration with its standard feedback, exact cache refresh and origin-owned completion. */
export const useSaveContentPillars = (owner?: ContentSaveOwner) => {
    const { trigger } = useMutateSaveContentPillarsSwr()
    const save = useContentSave(trigger, owner)
    return { save: (...args: Parameters<typeof trigger>) => save.exec(args), isPending: save.isPending }
}
