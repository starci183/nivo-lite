import type { ReactNode } from "react"
import { EntryFrame, Link, NavLandmark } from "@starci/grammar/common"
import { privacyHref, termsHref } from "@/modules/routes"

/** The auth copy and live pieces supplied by the layout. */
interface AuthFrameProps {
    readonly mainLabel: string
    readonly legalLabel: string
    readonly privacyLabel: string
    readonly termsLabel: string
    readonly localeSwitch: ReactNode
    readonly logo: ReactNode
    readonly children: ReactNode
}

/** The centred entry task: the logo and the language switch on one bar, the routed card alone in the middle, legal links below. */
export const AuthFrame = (props: AuthFrameProps) => (
    <EntryFrame
        layout="centred"
        label={props.mainLabel}
        identity={props.logo}
        tools={props.localeSwitch}
        footer={
            <NavLandmark label={props.legalLabel} layout="bar">
                <Link variant="plain" href={privacyHref()}>{props.privacyLabel}</Link>
                <Link variant="plain" href={termsHref()}>{props.termsLabel}</Link>
            </NavLandmark>
        }
    >
        {props.children}
    </EntryFrame>
)
