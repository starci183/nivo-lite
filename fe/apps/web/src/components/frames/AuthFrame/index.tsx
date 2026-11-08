import type { ReactNode } from "react"
import { Cluster, Link, NavLandmark, WorkspaceShell } from "@starci/grammar/common"
import { privacyHref, termsHref } from "@/modules/routes"
import { AUTH_BAR_CLASS_NAME, AUTH_BODY_CLASS_NAME, AUTH_CARD_CLASS_NAME, AUTH_MAIN_CLASS_NAME } from "./classNames"

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

/** The centred entry task: the bar with identity and language switch, the routed card in the middle of the page, legal links below. */
export const AuthFrame = (props: AuthFrameProps) => (
    <WorkspaceShell
        viewport="fixed"
        header={
            <div className={AUTH_BAR_CLASS_NAME}>
                <Cluster gap="section" justify="between" wrap={false}>
                    {props.logo}
                    {props.localeSwitch}
                </Cluster>
            </div>
        }
        primaryLabel={props.mainLabel}
        primary={
            <div className={AUTH_BODY_CLASS_NAME}>
                <div className={AUTH_MAIN_CLASS_NAME}>
                    <div className={AUTH_CARD_CLASS_NAME}>{props.children}</div>
                </div>
                <NavLandmark label={props.legalLabel} layout="bar">
                    <Link href={privacyHref()}>{props.privacyLabel}</Link>
                    <Link href={termsHref()}>{props.termsLabel}</Link>
                </NavLandmark>
            </div>
        }
    />
)
