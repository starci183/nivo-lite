import { LoyaltyCheckForm } from "@/components/blocks/LoyaltyCheckForm"

/** Props for {@link PublicLoyaltyPageBase}. */
export interface PublicLoyaltyPageBaseProps {
    readonly props: {
        readonly slug: string
    }
}

/** Draws the public points page: the check form of the shop, which draws its own shell with the shop in the bar. */
export const PublicLoyaltyPageBase = (props: PublicLoyaltyPageBaseProps) => <LoyaltyCheckForm slug={props.props.slug} />
