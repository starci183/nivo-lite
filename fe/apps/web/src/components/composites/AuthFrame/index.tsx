import type { ReactNode } from "react"
import { Freestyle, Heading, NavLandmark, Text, TextAction, WorkspaceShell } from "@starci/grammar/common"
import { privacyHref, termsHref } from "@/modules/routes"
import {
    AUTH_ART_COPY_CLASS_NAME,
    AUTH_ART_PANE_CLASS_NAME,
    AUTH_CARD_CLASS_NAME,
    AUTH_CENTER_CLASS_NAME,
    AUTH_COMPACT_LOGO_CLASS_NAME,
    AUTH_FORM_PANE_CLASS_NAME,
    AUTH_LEGAL_CLASS_NAME,
    AUTH_LOCALE_CLASS_NAME,
    AUTH_SPLIT_CLASS_NAME,
} from "./classNames"

/** The words of the brand side and the live pieces the layout supplies (language switch and logo are connected blocks). */
interface AuthFrameProps {
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

/** The split auth screen: the brand art (a Freestyle region: the pink block with one rounded corner, the logo and the large unicorn cropped at its foot) with the brand line under it, beside the routed auth card; the brand half hides on mobile. */
export const AuthFrame = (props: AuthFrameProps) => (
    <WorkspaceShell
        align="stretch"
        primaryLabel={props.mainLabel}
        primary={
            <div className={AUTH_SPLIT_CLASS_NAME}>
                <div className={AUTH_ART_PANE_CLASS_NAME}>
                    <Freestyle
                        reason="sign-in brand art"
                        className="relative min-h-0 flex-1 overflow-hidden rounded-br-[3rem] bg-[var(--accent-soft)]"
                    >
                        <div className="absolute left-8 top-8 z-10">{props.logo}</div>
                        <img
                            src="/images/entry/login-mascot.webp"
                            alt=""
                            aria-hidden="true"
                            className="absolute left-1/2 top-20 h-[115%] w-auto max-w-none -translate-x-1/2"
                            data-asset-sha256="de0a2c29360b590ed8ddf6a6aff50c2aa343e249dbc097f8dbd92d8b20e8918d"
                        />
                    </Freestyle>
                    <div className={AUTH_ART_COPY_CLASS_NAME}>
                        <Heading level={1}>{props.headline}</Heading>
                        <Text tone="muted">{props.tagline}</Text>
                    </div>
                </div>
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
            </div>
        }
    />
)
