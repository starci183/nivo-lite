"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
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

/** The marketplace catalogue next to the built-in modules: the approved listings, the values a buyer fills in, the install and the order. */
export const useMarketplace = () => {
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
