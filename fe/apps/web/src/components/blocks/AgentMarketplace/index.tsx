"use client"

import { useLocale, useTranslations } from "next-intl"
import { useMarketplace } from "@/hooks/templates"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentMarketplaceBase } from "./component"
import type { AgentMarketplaceBaseProps } from "./component"

/** The shape of a listing while the first read loads: the skeleton reuses the ready tree. */
const PLACEHOLDER: AgentMarketplaceBaseProps["props"]["placeholder"] = [
    { id: "-", name: "-", summary: "-", meta: "-", priceLabel: "-", isPaid: false, parameters: [], needs: "-" },
]

/** A text in both product languages. */
interface LocalizedText {
    readonly vi: string
    readonly en: string
}

/** The connected marketplace: approved listings with their settings, the free install in shadow mode, and the order of a paid one. */
export const AgentMarketplace = () => {
    const t = useTranslations("agentMarketplace")
    const locale = useLocale()
    const slotLabels = useSlotLabels()
    const market = useMarketplace()
    const pick = (text: LocalizedText): string => (locale === "vi" ? text.vi : text.en)
    const order = market.order
    return (
        <AgentMarketplaceBase
            props={{
                slot: mapSlot(market.slot, (listings): AgentMarketplaceBaseProps["props"]["placeholder"] =>
                    listings.map((listing) => ({
                        id: listing.id,
                        name: pick(listing.name),
                        summary: pick(listing.summary),
                        meta: t("meta", {
                            publisher: listing.publisherName,
                            version: listing.version,
                            person: listing.personName ?? t("neutralPersona"),
                        }),
                        priceLabel: listing.priceVnd === 0 ? t("free") : t("price", { amount: listing.priceVnd }),
                        isPaid: listing.priceVnd > 0,
                        parameters: listing.parameters.map((parameter) => ({
                            key: parameter.key,
                            label: `${pick(parameter.label)} (${parameter.defaultValue})`,
                            value: market.values[listing.id]?.[parameter.key] ?? "",
                        })),
                        needs: t("needs", {
                            providers: listing.requiredProviders.join(", "),
                            actions: listing.requiredAuthorityActions.join(", "),
                        }),
                    })),
                ),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("empty")),
                installLabel: t("install"),
                orderLabel: t("order"),
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
                setValue: market.setValue,
                install: (listingId) => {
                    const listing = market.slot
                    if ("items" in listing) {
                        const found = listing.items.find((entry) => entry.id === listingId)
                        if (found !== undefined) void market.install(listingId, found.parameters)
                    }
                },
                pay: (listingId) => void market.pay(listingId),
            }}
        />
    )
}
