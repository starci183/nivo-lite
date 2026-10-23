import { useQueryInventoryTemplatesSwr } from "@/hooks/swr"
import { toTemplateChoice } from "./inventoryStarter.shared"
import { readError } from "@/hooks/workspaceread"

/** The starter sets a business can load, through the `inventoryTemplates` query. */
export const useInventoryTemplates = () => {
    const swrRead = useQueryInventoryTemplatesSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return { templates: (data ?? []).map(toTemplateChoice), error, isLoading }
}
