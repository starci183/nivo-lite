import { isOfferLive as isLive } from "@/modules/promo"

export { FOUNDING_OFFER } from "@/modules/promo"

/** Shim for the lanes that still import the campaign from lib: the offer is live now. Wave 3 deletes it. */
export const isOfferLive = (now = Date.now()): boolean => isLive(now)
