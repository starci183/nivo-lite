import type { ReactNode } from "react"
import { Heading, Image, NavLandmark, SurfaceCard, Text, TextAction, WorkspaceShell } from "@starci/grammar/common"
import { privacyHref, termsHref } from "@/modules/routes"
import {
    AUTH_ART_BOTTOM_CLASS_NAME,
    AUTH_ART_COPY_CLASS_NAME,
    AUTH_ART_PANE_CLASS_NAME,
    AUTH_CARD_CLASS_NAME,
    AUTH_CENTER_CLASS_NAME,
    AUTH_COMPACT_LOGO_CLASS_NAME,
    AUTH_FORM_PANE_CLASS_NAME,
    AUTH_LEGAL_CLASS_NAME,
    AUTH_LOCALE_CLASS_NAME,
} from "./classNames"

/** The words of the brand side and the live pieces the layout supplies (language switch and logo are connected blocks). */
interface AuthFrameProps {
    readonly aboutLabel: string
    readonly mainLabel: string
    readonly headline: string
    readonly tagline: string
    readonly legalLabel: string
    readonly privacyLabel: string
    readonly termsLabel: string
    readonly localeSwitch: ReactNode
    readonly logo: ReactNode
    readonly children: ReactNode
}

/** The split auth screen: a full-height art pane with the brand pitch on the rail, the routed auth card centred beside it (the art pane hides on mobile). */
export const AuthFrame = (props: AuthFrameProps) => (
    <WorkspaceShell
        align="stretch"
        railPosition="leading"
        railWidth="wide"
        railLabel={props.aboutLabel}
        rail={
            <div className={AUTH_ART_PANE_CLASS_NAME}>
                <SurfaceCard
                    ariaLabel={props.aboutLabel}
                    treatment="ink"
                    artwork={
                        <Image
                            src="/images/entry/login-mascot.png"
                            alt=""
                            aspect="square"
                            fit="contain"
                            plate="none"
                            loading="eager"
                        />
                    }
                >
                    <div className={AUTH_ART_COPY_CLASS_NAME}>
                        {props.logo}
                        <div className={AUTH_ART_BOTTOM_CLASS_NAME}>
                            <Heading level={1}>{props.headline}</Heading>
                            <Text tone="muted">{props.tagline}</Text>
                        </div>
                    </div>
                </SurfaceCard>
            </div>
        }
        primaryLabel={props.mainLabel}
        primary={
            <div className={AUTH_FORM_PANE_CLASS_NAME}>
                <div className={AUTH_LOCALE_CLASS_NAME}>{props.localeSwitch}</div>
                <div className={AUTH_CENTER_CLASS_NAME}>
                    <div className={AUTH_COMPACT_LOGO_CLASS_NAME}>{props.logo}</div>
                    <div className={AUTH_CARD_CLASS_NAME}>{props.children}</div>
                </div>
                <div className={AUTH_LEGAL_CLASS_NAME}>
                    <NavLandmark label={props.legalLabel} layout="bar">
                        <TextAction href={privacyHref()} size="sm">
                            {props.privacyLabel}
                        </TextAction>
                        <TextAction href={termsHref()} size="sm">
                            {props.termsLabel}
                        </TextAction>
                    </NavLandmark>
                </div>
            </div>
        }
    />
)
