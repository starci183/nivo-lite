import type { PointsCalc } from "@modules/domain/loyalty-ledger"
import type { NotePart } from "../loyalty.contracts"

/** The lines of the note that explains how a purchase earned its points: the rate, the tier bonus and the points of the visit. */
export const earnNoteParts = (calc: PointsCalc): ReadonlyArray<NotePart> => [
    calc.label === ""
        ? { key: "loyalty.earn.rate", params: { rate: calc.rate } }
        : { key: "loyalty.earn.rateCategory", params: { rate: calc.rate, label: calc.label } },
    ...(calc.multiplier > 1
        ? [{ key: "loyalty.earn.tier", params: { tier: calc.tierName, multiplier: calc.multiplier } }]
        : []),
    ...(calc.perVisit > 0 ? [{ key: "loyalty.earn.visit", params: { points: calc.perVisit } }] : []),
]

/** The code a customer shows to receive a reward, made from the end of the redemption key. */
export const redeemCode = (ref: string): string =>
    `QT-${ref
        .replace(/[^a-z0-9]/giu, "")
        .slice(-6)
        .toUpperCase()
        .padStart(6, "0")}`
