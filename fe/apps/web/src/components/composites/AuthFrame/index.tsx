import type { ReactNode } from "react"
import {
    Heading,
    Image,
    IncludedMark,
    List,
    ListItem,
    NavLandmark,
    SurfaceCard,
    Text,
    TextAction,
    WorkspaceShell,
} from "@starci/grammar/common"
import { privacyHref, termsHref } from "@/modules/routes"
import {
    AUTH_ART_BAND_CLASS_NAME,
    AUTH_BRAND_PANE_CLASS_NAME,
    AUTH_BRAND_STACK_CLASS_NAME,
    AUTH_CARD_CLASS_NAME,
    AUTH_DETAILS_CLASS_NAME,
    AUTH_FORM_PANE_CLASS_NAME,
    AUTH_LEGAL_CLASS_NAME,
    AUTH_LOCALE_CLASS_NAME,
    AUTH_PITCH_CLASS_NAME,
    AUTH_POINTS_CLASS_NAME,
    AUTH_POINT_CLASS_NAME,
    AUTH_TAGLINE_CLASS_NAME,
} from "./classNames"

/** The words of the brand side and the live pieces the layout supplies (language switch, logo and offer are connected blocks). */
interface AuthFrameProps {
    readonly aboutLabel: string
    readonly mainLabel: string
    readonly headline: string
    readonly tagline: string
    readonly points: ReadonlyArray<string>
    readonly legalLabel: string
    readonly privacyLabel: string
    readonly termsLabel: string
    readonly localeSwitch: ReactNode
    readonly logo: ReactNode
    readonly offer: ReactNode
    readonly children: ReactNode
}

/** The split auth screen: brand pitch on the rail, the routed auth card beside it (stacked on mobile). */
export const AuthFrame = (props: AuthFrameProps) => (
    <WorkspaceShell
        align="stretch"
        header={<div className={AUTH_LOCALE_CLASS_NAME}>{props.localeSwitch}</div>}
        railPosition="leading"
        railWidth="wide"
        railLabel={props.aboutLabel}
        rail={
            <div className={AUTH_BRAND_PANE_CLASS_NAME}>
                <SurfaceCard ariaLabel={props.aboutLabel} composition="joined">
                    <div className={AUTH_ART_BAND_CLASS_NAME} aria-hidden="true">
                        <Image
                            src="/images/entry/login-mascot.png"
                            alt=""
                            aspect="wide"
                            fit="contain"
                            plate="none"
                            loading="eager"
                        />
                    </div>
                    <div className={AUTH_BRAND_STACK_CLASS_NAME}>
                        <div className={AUTH_PITCH_CLASS_NAME}>
                            {props.logo}
                            <Heading level={1}>{props.headline}</Heading>
                            <div className={AUTH_TAGLINE_CLASS_NAME}>
                                <Text tone="muted">{props.tagline}</Text>
                            </div>
                        </div>
                        <div className={AUTH_DETAILS_CLASS_NAME}>
                            <List className={AUTH_POINTS_CLASS_NAME}>
                                {props.points.map((point) => (
                                    <ListItem key={point} className={AUTH_POINT_CLASS_NAME}>
                                        <IncludedMark />
                                        <Text>{point}</Text>
                                    </ListItem>
                                ))}
                            </List>
                            {props.offer}
                        </div>
                    </div>
                </SurfaceCard>
            </div>
        }
        primaryLabel={props.mainLabel}
        primary={
            <div className={AUTH_FORM_PANE_CLASS_NAME}>
                <div className={AUTH_CARD_CLASS_NAME}>
                    {props.children}
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
