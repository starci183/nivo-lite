import { useMutateSaveContentCadenceSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"

/** Saves configuration through GraphQL, toasts its outcome and refreshes content data. */
export const useSaveContentCadence = () => {
    const { trigger, isMutating } = useMutateSaveContentCadenceSwr()
    return { save: useContentSave(trigger), isMutating }
}
