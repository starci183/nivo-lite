"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import type { MarketplaceListingsData } from "@/modules/api/graphql"
import type { DataSlot } from "@/modules/types"
import {
    useMutateInstallTemplateListingSwr,
    useMutateOrderTemplateListingSwr,
    useQueryMarketplaceListingsSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/** What the buyer sees of the order of a paid listing: the transfer to make. */
export interface PlacedOrder {
    readonly listingId: string
    readonly orderCode: string
    readonly amountVnd: number
    readonly qrUrl: string
    readonly bank: string
    readonly account: string
    readonly holder: string
}

/** What the marketplace reads and does. */
export interface MarketplaceController {
    /** The approved listings. */
    readonly slot: DataSlot<MarketplaceListingsData>
    /** Reads the listings again. */
    readonly reload: () => void
    /** The values the buyer wrote, by listing and parameter. */
    readonly values: Record<string, Record<string, string>>
    /** Writes one value. */
    readonly setValue: (listingId: string, key: string, value: string) => void
    /** The transfer to make for the listing just ordered. */
    readonly order: PlacedOrder | undefined
    /** True while a command runs. */
    readonly isPending: boolean
    /** Installs a listing in shadow mode. */
    readonly install: (listingId: string, parameters: ReadonlyArray<{ key: string; kind: string }>) => Promise<void>
    /** Orders a paid listing. */
    readonly pay: (listingId: string) => Promise<void>
}

/** The marketplace catalogue next to the built-in modules: the approved listings, the values a buyer fills in, the install and the order. */
export const useMarketplace = (): MarketplaceController => {
    const t = useTranslations("agentMarketplace")
    const run = useGraphQLWithToast()
    const listings = useQueryMarketplaceListingsSwr()
    const installer = useMutateInstallTemplateListingSwr()
    const orderer = useMutateOrderTemplateListingSwr()
    const [values, setValues] = useState<Record<string, Record<string, string>>>({})
    const [order, setOrder] = useState<PlacedOrder | undefined>(undefined)
    const slot = slotOfSwr({ data: listings.data, error: listings.error, isLoading: listings.isLoading })
    const setValue = (listingId: string, key: string, value: string) =>
        setValues((current) => ({ ...current, [listingId]: { ...current[listingId], [key]: value } }))
    const valuesFor = (listingId: string, parameters: ReadonlyArray<{ key: string; kind: string }>) =>
        Object.fromEntries(
            parameters.flatMap((parameter): Array<[string, number | string | boolean]> => {
                const given = values[listingId]?.[parameter.key]
                if (given === undefined || given === "") return []
                if (parameter.kind === "number") return [[parameter.key, Number(given)]]
                return [[parameter.key, parameter.kind === "toggle" ? given === "true" : given]]
            }),
        )
    const install = async (listingId: string, parameters: ReadonlyArray<{ key: string; kind: string }>) => {
        await run(() => installer.trigger({ listingId, values: valuesFor(listingId, parameters) }), {
            successMessage: t("installed"),
        })
    }
    const pay = async (listingId: string) => {
        const placed = await run(() => orderer.trigger({ listingId }))
        setOrder(placed === undefined ? undefined : { ...placed, listingId })
    }
    return {
        slot,
        reload: () => void listings.mutate(),
        values,
        setValue,
        order,
        isPending: installer.isMutating || orderer.isMutating,
        install,
        pay,
    }
}
