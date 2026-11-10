import { AvatarButton, StatusDot } from "@starci/grammar/common"
import { ANCHOR_CLASS, BADGE_CLASS, BUBBLE_CLASS, BUBBLE_OVER_COMPOSER_CLASS, CLEARANCE_CLASS } from "./classNames"

/** The resolved words and state of the floating button. */
interface GuideBubbleBaseProps {
    readonly props: {
        /** The page is a messenger, the Second Brain or an agent detail with its own composer and panels: the button rises above the composer on a tablet or wider and is not drawn on a phone. */
        readonly overComposer: boolean
        /** There are things to do: a dot sits on the button. */
        readonly hasTodo: boolean
        readonly label: string
        readonly todoLabel: string
        readonly imageSrc: string
    }
    readonly on: {
        readonly toggle: () => void
    }
}

/**
 * The floating button of the guide: the NIVO AI face, round, with a dot when there is something to do. It never covers the page: on a page
 * without a composer, a phone-width spacer after the routed page gives the scroll area a bottom inset of the button's height plus a gap;
 * on a page with a composer and panes of its own, the button rises above the composer (tablet and wider) or is not drawn (phone).
 */
export const GuideBubbleBase = (props: GuideBubbleBaseProps) => (
    <>
        {props.props.overComposer ? null : <div aria-hidden="true" className={CLEARANCE_CLASS} />}
        <div className={props.props.overComposer ? BUBBLE_OVER_COMPOSER_CLASS : BUBBLE_CLASS}>
            <div className={ANCHOR_CLASS}>
                <AvatarButton
                    name={props.props.label}
                    src={props.props.imageSrc}
                    size="floating"
                    onPress={props.on.toggle}
                />
                {props.props.hasTodo ? (
                    <div className={BADGE_CLASS}>
                        <StatusDot tone="danger" size="md" aria-label={props.props.todoLabel} />
                    </div>
                ) : null}
            </div>
        </div>
    </>
)
