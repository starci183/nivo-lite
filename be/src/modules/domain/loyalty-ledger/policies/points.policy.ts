import type { LoyaltyCategoryRule, LoyaltyConfig, TierMatch } from "@modules/domain/loyalty-programs"
import type { PointsCalc, PurchaseFacts } from "../loyalty-ledger.contracts"

const THOUSAND = 1000

/** Text with its accents, case and the Vietnamese d-bar folded away, for matching. */
const fold = (text: string): string =>
    text
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/\u0111/giu, "d")
        .toLowerCase()

/**
 * The points one purchase earns. The rate is the best matching category rule (the items text contains the rule's word) or the
 * general rate; the tier multiplier applies to the spend points; the points of the visit are added after; the sum is rounded down.
 * An order below the smallest one that earns points earns none.
 */
export const pointsFor = (config: LoyaltyConfig, purchase: PurchaseFacts, tier: TierMatch): PointsCalc => {
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
