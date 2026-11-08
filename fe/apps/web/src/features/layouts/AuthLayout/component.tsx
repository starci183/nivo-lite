import type { ReactNode } from "react"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { AuthFrame } from "@/components/frames/AuthFrame"

/** The words of the entry frame, resolved by the layout. */
export interface AuthLayoutBaseProps {
    readonly props: {
        readonly mainLabel: string
        readonly legalLabel: string
        readonly privacyLabel: string
        readonly termsLabel: string
    }
    readonly children: ReactNode
}

/** Draws the centred sign-in screen around the routed card: logo and language switch on top, legal links below. */
export const AuthLayoutBase = (props: AuthLayoutBaseProps) => (
    <AuthFrame
        mainLabel={props.props.mainLabel}
        legalLabel={props.props.legalLabel}
        privacyLabel={props.props.privacyLabel}
        termsLabel={props.props.termsLabel}
        localeSwitch={<LocaleSwitch />}
        logo={<BrandLogo variant="full" height={40} />}
    >
        {props.children}
    </AuthFrame>
)
