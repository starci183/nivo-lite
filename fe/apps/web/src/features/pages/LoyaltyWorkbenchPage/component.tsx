import { LoyaltyWorkbench } from "@/components/blocks/LoyaltyWorkbench"

/** The same server route identity and translated panel labels. */
export interface LoyaltyWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string
        readonly initialTab: string | null
        readonly tabs: {
            readonly overview: string
            readonly members: string
            readonly rewards: string
            readonly promo: string
            readonly pending: string
        }
    }
}

/** Composes the one actual Loyalty workbench world from server-resolved atoms. */
export const LoyaltyWorkbenchPageBase = (props: LoyaltyWorkbenchPageBaseProps) => <LoyaltyWorkbench {...props.props} />
