import { useQueryInventoryTemplatesSwr } from "@/hooks/swr"
import { toTemplateChoice } from "./inventoryStarter.shared"
import { readError } from "@/hooks/workspaceread"
import type { SWRResponse } from "swr"
import type { InventoryTemplateChoice } from "@/modules/types"

/** The view `useInventoryTemplates` returns. */
export interface InventoryTemplatesView {
    read: SWRResponse<
        {
            description: string
            key: string
            name: string
        }[]
    >
    reload: () => Promise<
        | {
              description: string
              key: string
              name: string
          }[]
        | undefined
    >
    templates: InventoryTemplateChoice[]
    error: unknown
    isLoading: boolean
}

/** The starter sets a business can load, through the `inventoryTemplates` query. */
export const useInventoryTemplates = (isActive = true): InventoryTemplatesView => {
    const swrRead = useQueryInventoryTemplatesSwr(isActive)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return {
        read: swrRead,
        reload: () => swrRead.mutate(),
        templates: (data ?? []).map(toTemplateChoice),
        error,
        isLoading,
    }
}
