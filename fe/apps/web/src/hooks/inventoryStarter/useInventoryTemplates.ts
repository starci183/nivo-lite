import { useQueryInventoryTemplatesSwr } from "@/hooks/swr"
import { toTemplateChoice } from "./inventoryStarter.shared"

/** The starter sets a business can load, through the `inventoryTemplates` query. */
export const useInventoryTemplates = () => {
    const { data, error, isLoading } = useQueryInventoryTemplatesSwr()
    return { templates: (data ?? []).map(toTemplateChoice), error, isLoading }
}
