import type { ReactNode } from "react"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { AuthFrame } from "@/components/composites/AuthFrame"

/** The words of the brand side, resolved by the layout. */
export interface AuthLayoutBaseProps {
    readonly props: {
        readonly aboutLabel: string
        readonly mainLabel: string
        readonly headline: string
        readonly tagline: string
        readonly legalLabel: string
        readonly privacyLabel: string
        readonly termsLabel: string
    }
    readonly children: ReactNode
}

/** Draws the split sign-in screen around the routed card: brand pitch on the art pane, language switch and legal links. */
export const AuthLayoutBase = (props: AuthLayoutBaseProps) => (
    <AuthFrame
        aboutLabel={props.props.aboutLabel}
        mainLabel={props.props.mainLabel}
        headline={props.props.headline}
        tagline={props.props.tagline}
        legalLabel={props.props.legalLabel}
        privacyLabel={props.props.privacyLabel}
        termsLabel={props.props.termsLabel}
        localeSwitch={<LocaleSwitch />}
        logo={<BrandLogo variant="full" height={40} />}
    >
        {props.children}
    </AuthFrame>
)
