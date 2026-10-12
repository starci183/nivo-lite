import { FOUNDING_OFFER, isOfferLive } from "@/lib/promo"

/** The Founding 50 campaign facts a block draws: its numbers and dates, and whether it is running now. */
export const useFoundingOffer = () => ({ offer: FOUNDING_OFFER, isLive: isOfferLive() })
