"use client"

import { useSyncExternalStore } from "react"
import { FOUNDING_OFFER, isOfferLive } from "@/modules/promo"

/** What a promo card needs to know about the Founding 50 offer. */
export interface PromoOffer {
    /** True once the browser checked that the offer window is open now; false on the server render. */
    readonly live: boolean
    /** The name of the campaign. */
    readonly name: string
    /** The percentage taken off. */
    readonly percentOff: number
    /** Where the campaign sends the reader. */
    readonly ctaHref: string
}

const unsubscribe = (): void => undefined
const subscribe = (): (() => void) => unsubscribe

/** The Founding 50 offer, with its window checked against the browser clock (the server render never claims it is live). */
export const usePromoOffer = (): PromoOffer => {
    const live = useSyncExternalStore(
        subscribe,
        () => isOfferLive(Date.now()),
        () => false,
    )
    return { live, name: FOUNDING_OFFER.name, percentOff: FOUNDING_OFFER.percentOff, ctaHref: FOUNDING_OFFER.ctaHref }
}
