/**
 * Founding 50 campaign (a Brand V1.1 "Signal": what changes, from when, for whom, conditions, next step).
 * Numbers, dates and the cap come from here; the wording lives in src/i18n/dict/promo.ts (vi + en).
 * TO CONFIRM BY THE OWNER before anything is published: percent, cap, dates and conditions are a commercial offer.
 */
export const FOUNDING_OFFER = {
  enabled: true,
  name: "Founding 50",
  percentOff: 50,
  cap: 50,
  startsAt: "2026-09-29T00:00:00+07:00",
  endsAt: "2026-10-31T23:59:59+07:00",
  /** Real number of founding slots taken, set by the owner. `null` hides the counter — never guess it. */
  slotsClaimed: null as number | null,
  ctaHref: "/modules/new?module=chatbot",
} as const;

export const isOfferLive = (now = Date.now()) =>
  FOUNDING_OFFER.enabled && now >= Date.parse(FOUNDING_OFFER.startsAt) && now <= Date.parse(FOUNDING_OFFER.endsAt);
