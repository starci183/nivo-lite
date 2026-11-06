import type { ReactNode } from "react"
import { EntryFrame, Freestyle, Heading, Link, NavLandmark, Stack, Text } from "@starci/grammar/common"
import { privacyHref, termsHref } from "@/modules/routes"

/** The auth copy and live pieces supplied by the layout. */
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

/** The native entry task owns split layout, compact identity, tools, form measure and legal footer; the artwork remains app-owned. */
export const AuthFrame = (props: AuthFrameProps) => (
    <EntryFrame
        label={props.mainLabel}
        artwork={
            <Freestyle
                reason="sign-in brand art"
                className="relative min-h-0 flex-1 overflow-hidden bg-[var(--accent-soft)]"
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
        }
        intro={
            <Stack gap="inline">
                <Heading level={1}>{props.headline}</Heading>
                <Text tone="muted">{props.tagline}</Text>
            </Stack>
        }
        identity={props.logo}
        tools={props.localeSwitch}
        footer={
            <NavLandmark label={props.legalLabel} layout="bar">
                <Link href={privacyHref()}>{props.privacyLabel}</Link>
                <Link href={termsHref()}>{props.termsLabel}</Link>
            </NavLandmark>
        }
    >
        {props.children}
    </EntryFrame>
)
