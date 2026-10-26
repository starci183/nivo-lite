import { NavLandmark, TextAction } from "@starci/grammar/common"
import { NAV_LINKS } from "./classNames"

/** One in-page destination of the bar. */
interface LandingNavLinksLink {
    readonly id: string
    readonly label: string
    readonly href: string
}

/** The in-page anchors of the bar. */
interface LandingNavLinksBaseProps {
    readonly props: {
        readonly navLabel: string
        readonly links: ReadonlyArray<LandingNavLinksLink>
    }
}

/** The navigation slot of the top bar: the in-page anchors. */
export const LandingNavLinksBase = (props: LandingNavLinksBaseProps) => (
    <div className={NAV_LINKS}>
        <NavLandmark label={props.props.navLabel} layout="bar">
            {props.props.links.map((link) => (
                <TextAction key={link.id} href={link.href} appearance="route" size="control">
                    {link.label}
                </TextAction>
            ))}
        </NavLandmark>
    </div>
)
