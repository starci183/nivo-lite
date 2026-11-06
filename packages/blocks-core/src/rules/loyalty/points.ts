import type { LoyaltyCategoryRule, LoyaltyConfig, LoyaltyTier } from "./config.types"
import { fold } from "./fold"
import type { PointsCalc, PurchaseFacts } from "./ledger.types"

const THOUSAND = 1000

/**
 * The points one purchase earns. The rate is the best matching category rule (the items text contains the rule's word) or the
 * general rate; the tier multiplier applies to the spend points; the points of the visit are added after; the sum is rounded down.
 * An order below the smallest one that earns points earns none.
 */
export const pointsFor = (config: LoyaltyConfig, purchase: PurchaseFacts, tier: LoyaltyTier | null): PointsCalc => {
    const amount = Math.max(0, Math.round(purchase.amountVnd))
    const multiplier = tier?.multiplier ?? 1
    const none: PointsCalc = {
        points: 0,
        rate: 0,
        label: "",
        multiplier,
        tierName: tier?.name ?? "",
        perVisit: config.earn.perVisit,
        belowMinimum: true,
    }
    if (amount <= 0 || amount < config.earn.minOrderVnd) return none
    const items = fold(purchase.items)
    const matched = config.earn.categories
        .filter(
            (rule) =>
                fold(rule.match) !== "" &&
                items.includes(fold(rule.match)) &&
                rule.perThousandVnd > config.earn.perThousandVnd,
        )
        .reduce<LoyaltyCategoryRule>((best, rule) => (rule.perThousandVnd > best.perThousandVnd ? rule : best), {
            match: "",
            perThousandVnd: config.earn.perThousandVnd,
            label: "",
        })
    return {
        ...none,
        points: Math.floor((amount / THOUSAND) * matched.perThousandVnd * multiplier) + config.earn.perVisit,
        rate: matched.perThousandVnd,
        label: matched.label === "" ? matched.match : matched.label,
        belowMinimum: false,
    }
}

/**
 * The note that explains how a purchase earned its points, in a notation that needs no language: the rate per thousand VND, the
 * tier multiplier and the points of the visit, for instance "1.5/1k x 1.2 B\u1ea1c + 5".
 */
export const earnEvidence = (calc: PointsCalc): string => {
    const rate = calc.label === "" ? `${calc.rate}/1k` : `${calc.rate}/1k ${calc.label}`
    const tier = calc.multiplier > 1 ? ` x ${calc.multiplier} ${calc.tierName}` : ""
    const visit = calc.perVisit > 0 ? ` + ${calc.perVisit}` : ""
    return `${rate}${tier}${visit}`
}
