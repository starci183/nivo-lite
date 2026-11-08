"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { kindOf, parameterErrorOf, useMarketplace, type ParameterRule, type ParameterWords } from "@/hooks/templates"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentMarketplaceBase, type AgentMarketplaceBaseProps } from "./component"

/** The shape of a listing while the first read loads: the skeleton reuses the ready tree. */
const PLACEHOLDER: AgentMarketplaceBaseProps["props"]["placeholder"] = [
    { id: "-", name: "-", summary: "-", meta: "-", priceLabel: "-", isPaid: false, parameters: [], needs: "-" },
]

/** What a parameter says about its choices. */
interface ChoiceSource {
    readonly options?: ReadonlyArray<{ readonly value: string }> | null
}

/** The values a choice parameter accepts, none for the other kinds. */
const choicesOf = (parameter: ChoiceSource): ReadonlyArray<string> =>
    (parameter.options ?? []).map((option) => option.value)

/** A text in both product languages. */
interface LocalizedText {
    readonly vi: string
    readonly en: string
}

type Listing = Extract<ReturnType<typeof useMarketplace>["slot"], { readonly items: unknown }>["items"][number]
type ListingViews = AgentMarketplaceBaseProps["props"]["placeholder"]

/** What drawing one listing reads besides the listing: the words, the language, and the value and error of each field. */
interface ListingLens {
    readonly t: ReturnType<typeof useTranslations<"agentMarketplace">>
    readonly pick: (text: LocalizedText) => string
    readonly valueOf: (listingId: string, key: string) => string
    readonly errorOf: (rule: ParameterRule, value: string) => string
}

/** One approved listing as the tile and its install dialog draw it, every word resolved. */
const listingViewOf = (listing: Listing, lens: ListingLens): ListingViews[number] => ({
    id: listing.id,
    name: lens.pick(listing.name),
    summary: lens.pick(listing.summary),
    meta: lens.t("meta", {
        publisher: listing.publisherName,
        version: listing.version,
        person: listing.personName ?? lens.t("neutralPersona"),
    }),
    priceLabel: listing.priceVnd === 0 ? lens.t("free") : lens.t("price", { amount: listing.priceVnd }),
    isPaid: listing.priceVnd > 0,
    parameters: listing.parameters.map((parameter) => {
        const value = lens.valueOf(listing.id, parameter.key)
        return {
            key: parameter.key,
            label: lens.pick(parameter.label),
            value,
            kind: kindOf(parameter.kind),
            hint: parameter.hint === null ? "" : lens.pick(parameter.hint),
            min: parameter.min ?? null,
            max: parameter.max ?? null,
            error: lens.errorOf({ ...parameter, choices: choicesOf(parameter) }, value),
            options: (parameter.options ?? []).map((option) => ({ id: option.value, label: lens.pick(option.label) })),
        }
    }),
    needs: lens.t("needs", {
        providers: listing.requiredProviders.join(", "),
        actions: listing.requiredAuthorityActions.join(", "),
    }),
})

/** The connected marketplace: approved listings with their settings, the free install in shadow mode, and the order of a paid one. */
export const AgentMarketplace = () => {
    const t = useTranslations("agentMarketplace")
    const locale = useLocale()
    const slotLabels = useSlotLabels()
    const market = useMarketplace()
    const [installingId, setInstallingId] = useState<string | null>(null)
    const [isAsked, setIsAsked] = useState(false)
    const pick = (text: LocalizedText): string => (locale === "vi" ? text.vi : text.en)
    const order = market.order
    const words: ParameterWords = {
        required: t("fieldRequired"),
        notNumber: t("fieldNumber"),
        notTime: t("fieldTime"),
        notChoice: t("fieldChoice"),
        tooSmall: (min) => t("fieldMin", { min }),
        tooLarge: (max) => t("fieldMax", { max }),
    }
    const errorOf = (rule: ParameterRule, value: string): string => parameterErrorOf(words, isAsked, rule, value)
    const valueOf = (listingId: string, key: string): string => market.values[listingId]?.[key] ?? ""
    const lens: ListingLens = { t, pick, valueOf, errorOf }
    return (
        <AgentMarketplaceBase
            props={{
                slot: mapSlot(market.slot, (listings): ListingViews =>
                    listings.map((listing) => listingViewOf(listing, lens)),
                ),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("empty")),
                installLabel: t("install"),
                orderLabel: t("order"),
                cancelLabel: t("cancel"),
                installingId,
                order:
                    order === undefined
                        ? undefined
                        : {
                              listingId: order.listingId,
                              title: t("orderTitle", { code: order.orderCode, amount: order.amountVnd }),
                              lines: [order.bank, order.account, order.holder],
                              qrUrl: order.qrUrl,
                          },
                isPending: market.isPending,
            }}
            on={{
                retry: market.reload,
                openInstall: (id) => {
                    setInstallingId(id)
                    setIsAsked(false)
                },
                setValue: market.setValue,
                install: (listingId) => {
                    const found =
                        "items" in market.slot ? market.slot.items.find((entry) => entry.id === listingId) : undefined
                    setIsAsked(true)
                    if (found === undefined) return
                    // Once asked, a missing required value counts too, so the dialog stays open and shows what is wrong.
                    const isBlocked = found.parameters.some(
                        (parameter) =>
                            parameterErrorOf(
                                words,
                                true,
                                { ...parameter, choices: choicesOf(parameter) },
                                valueOf(listingId, parameter.key),
                            ) !== "",
                    )
                    if (isBlocked) return
                    void market.install(listingId, found.parameters)
                    setInstallingId(null)
                    setIsAsked(false)
                },
                pay: (listingId) => void market.pay(listingId),
            }}
        />
    )
}
