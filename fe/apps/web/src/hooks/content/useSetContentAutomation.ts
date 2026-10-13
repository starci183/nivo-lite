import { useMutateSetContentAutomationSwr } from "@/hooks/swr"
import { useContentSave } from "./useContentSave"

/** Saves configuration through GraphQL, toasts its outcome and refreshes content data. */
export const useSetContentAutomation = () => {
    const { trigger, isMutating } = useMutateSetContentAutomationSwr()
    return { set: useContentSave(trigger), isMutating }
}
