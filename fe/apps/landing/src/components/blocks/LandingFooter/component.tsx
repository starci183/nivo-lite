import { Footer, Image, Text, TextAction } from "@starci/grammar/common"
import { FOOT_BRAND, FOOT_LEGAL } from "./classNames"

/** One link of a footer directory. */
interface LandingFooterLink {
    readonly id: string
    readonly label: string
    readonly href: string
}

/** One directory column of the footer. */
interface LandingFooterGroup {
    readonly id: string
    readonly label: string
    readonly links: ReadonlyArray<LandingFooterLink>
}

/** The resolved words and addresses the landing footer draws. */
interface LandingFooterBaseProps {
    readonly props: {
        readonly label: string
        readonly homeHref: string
        readonly homeLabel: string
        readonly logoSrc: string
        readonly about: string
        readonly tagline: string
        readonly groups: ReadonlyArray<LandingFooterGroup>
        readonly copyright: string
        readonly legalLine: string
        readonly legalNote: string
    }
}

/** Logo size: the approved raster is 322 by 114, drawn 40 high. */
const LOGO_WIDTH = 113
const LOGO_HEIGHT = 40

/** The landing footer: brand, three link directories and the legal row with the unconfirmed details flagged. */
export const LandingFooterBase = (props: LandingFooterBaseProps) => (
    <Footer
        label={props.props.label}
        brand={
            <div className={FOOT_BRAND}>
                <TextAction href={props.props.homeHref}>
                    <Image
                        src={props.props.logoSrc}
                        alt={props.props.homeLabel}
                        width={LOGO_WIDTH}
                        height={LOGO_HEIGHT}
                        aspect="auto"
                        fit="contain"
                        plate="none"
                    />
                </TextAction>
                <Text size="sm" tone="muted">
                    {props.props.about}
                </Text>
                <Text size="sm" weight="medium">
                    {props.props.tagline}
                </Text>
            </div>
        }
        groups={props.props.groups}
        legal={
            <div className={FOOT_LEGAL}>
                <Text size="sm">{props.props.copyright}</Text>
                <Text size="sm" tone="muted">
                    {props.props.legalLine}
                </Text>
                <Text size="xs">{props.props.legalNote}</Text>
            </div>
        }
    />
)
