import { useMutateSaveContentBrandSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"

/** Saves configuration through GraphQL, toasts its outcome and refreshes content data. */
export const useSaveContentBrand = () => {
    const { trigger, isMutating } = useMutateSaveContentBrandSwr()
    return { save: useContentSave(trigger), isMutating }
}
