"use client"

import { useLocale } from "next-intl"
import { useParams } from "next/navigation"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryProviderRightHoldersSwr } from "@/hooks/swr"
import type { NodeRightsRead, ProviderRightHoldersView } from "@/modules/types"
import { providerRightHoldersOf } from "./nodeRights.shared"
import { useNodeRightsWords } from "./useNodeRightsWords"
import { useStepHrefOf } from "./useStepHrefOf"

/**
 * Who holds each right of the account the address names (`/connections/open/<id>/rights`), read-only, each holder linked to its
 * step; the counts of the filter tabs come from the server.
 */
export const useProviderRightHolders = (): NodeRightsRead<ProviderRightHoldersView> => {
    const locale = useLocale()
    const words = useNodeRightsWords()
    const hrefOf = useStepHrefOf()
    const params = useParams<{ id?: string }>()
    const read = useQueryProviderRightHoldersSwr(typeof params.id === "string" ? params.id : null)
    return {
        slot: mapSlot(slotOfSwr(read), (wire) => providerRightHoldersOf(wire, words, locale, hrefOf)),
        retry: () => void read.mutate(),
    }
}
