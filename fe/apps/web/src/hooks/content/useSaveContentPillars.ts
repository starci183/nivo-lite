import { useMutateSaveContentPillarsSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"

/** Saves configuration through GraphQL, toasts its outcome and refreshes content data. */
export const useSaveContentPillars = () => {
    const { trigger, isMutating } = useMutateSaveContentPillarsSwr()
    return { save: useContentSave(trigger), isMutating }
}
