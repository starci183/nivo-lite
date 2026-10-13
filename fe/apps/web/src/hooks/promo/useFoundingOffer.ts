import { FOUNDING_OFFER } from "@/modules/promo"
import { usePromoOffer } from "./usePromoOffer"

/** The Founding 50 campaign facts a block draws: its numbers and dates, and whether it is running now. */
export const useFoundingOffer = () => ({ offer: FOUNDING_OFFER, isLive: usePromoOffer().live })
