import { useMutateSaveContentBrandSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"
import type { ContentSaveOwner } from "./useContentSave"

/** The trigger of the brand write, whose arguments and result the command repeats. */
type SaveBrandTrigger = ReturnType<typeof useMutateSaveContentBrandSwr>["trigger"]

/** The view `useSaveContentBrand` returns. */
export interface SaveContentBrandView {
    save: (...args: Parameters<SaveBrandTrigger>) => Promise<Awaited<ReturnType<SaveBrandTrigger>> | undefined>
    isPending: boolean
}

/** Saves configuration with its standard feedback, exact cache refresh and origin-owned completion. */
export const useSaveContentBrand = (owner?: ContentSaveOwner): SaveContentBrandView => {
    const { trigger } = useMutateSaveContentBrandSwr()
    const save = useContentSave(trigger, owner)
    return { save: (...args: Parameters<typeof trigger>) => save.exec(args), isPending: save.isPending }
}
