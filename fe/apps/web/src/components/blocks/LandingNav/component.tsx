import { Button, Image, NavLandmark, TextAction, TopBar } from "@starci/grammar/common"
import { LocaleSegments } from "@/components/composites/LocaleSegments"
import { NAV_LINKS, NAV_SIGNIN } from "./classNames"

/** One in-page destination of the bar. */
interface LandingNavLink {
    readonly id: string
    readonly label: string
    readonly href: string
}

/** The resolved words and addresses the landing top bar draws. */
interface LandingNavBaseProps {
    readonly props: {
        readonly homeHref: string
        readonly homeLabel: string
        readonly logoSrc: string
        readonly navLabel: string
        readonly links: ReadonlyArray<LandingNavLink>
        readonly accountHref: string
        readonly accountLabel: string
        readonly tryHref: string
        readonly tryLabel: string
        readonly language: {
            readonly label: string
            readonly locale: string
            readonly isPending: boolean
            readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
        }
    }
    readonly on: {
        readonly chooseLocale: (locale: string) => void
    }
}

/** Logo size: the approved raster is 322 by 114, drawn 36 high. */
const LOGO_WIDTH = 102
const LOGO_HEIGHT = 36

/** The sticky top bar: logo, in-page anchors, language switch and the sign-in and try actions. */
export const LandingNavBase = (props: LandingNavBaseProps) => (
    <TopBar
        position="sticky"
        brand={
            <TextAction href={props.props.homeHref}>
                <Image
                    src={props.props.logoSrc}
                    alt={props.props.homeLabel}
                    width={LOGO_WIDTH}
                    height={LOGO_HEIGHT}
                    aspect="auto"
                    fit="contain"
                    plate="none"
                    loading="eager"
                />
            </TextAction>
        }
        navigation={
            <div className={NAV_LINKS}>
                <NavLandmark label={props.props.navLabel} layout="bar">
                    {props.props.links.map((link) => (
                        <TextAction key={link.id} href={link.href} appearance="route" size="sm">
                            {link.label}
                        </TextAction>
                    ))}
                </NavLandmark>
            </div>
        }
        actions={
            <>
                <LocaleSegments
                    label={props.props.language.label}
                    value={props.props.language.locale}
                    options={props.props.language.options}
                    isDisabled={props.props.language.isPending}
                    onChange={props.on.chooseLocale}
                />
                <div className={NAV_SIGNIN}>
                    <Button variant="ghost" size="sm" href={props.props.accountHref}>
                        {props.props.accountLabel}
                    </Button>
                </div>
                <Button variant="secondary" size="sm" href={props.props.tryHref}>
                    {props.props.tryLabel}
                </Button>
            </>
        }
    />
)
