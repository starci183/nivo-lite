import { Image, TextAction } from "@starci/grammar/common"

/** The words and address of the logo link. */
interface LandingNavBrandBaseProps {
    readonly props: {
        readonly homeHref: string
        readonly homeLabel: string
        readonly logoSrc: string
    }
}

/** Logo size: the approved raster is 322 by 114, drawn 36 high. */
const LOGO_WIDTH = 102
const LOGO_HEIGHT = 36

/** The brand slot of the top bar: the logo as a link home. */
export const LandingNavBrandBase = (props: LandingNavBrandBaseProps) => (
    <TextAction href={props.props.homeHref} size="control">
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
)
