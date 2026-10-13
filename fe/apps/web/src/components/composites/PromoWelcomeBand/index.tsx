import { Button, CloseButton, Heading, Image, SurfaceCard, Text } from "@starci/grammar/common"
import { WELCOME_ACTIONS, WELCOME_COPY, WELCOME_HEAD } from "./classNames"

/** Copy, links and handler of the welcome band. */
export interface PromoWelcomeBandProps {
    readonly ariaLabel: string
    readonly title: string
    readonly text: string
    readonly closeLabel: string
    readonly testLabel: string
    readonly testHref: string
    readonly officeLabel: string
    readonly officeHref: string
    readonly onClose: () => void
}

/**
 * Draws the first-run welcome of a Founding 50 member: the ink band with the celebrating mascot in the artwork slot.
 * A primary button on the ink band is accent on accent, so the dominant action takes the secondary variant.
 */
export const PromoWelcomeBand = (props: PromoWelcomeBandProps) => (
    <SurfaceCard
        treatment="ink"
        ariaLabel={props.ariaLabel}
        artwork={<Image src="/images/promo/mascot-celebrate.png" alt="" aspect="auto" fit="contain" />}
    >
        <div className={WELCOME_COPY}>
            <div className={WELCOME_HEAD}>
                <Heading level={2}>{props.title}</Heading>
                <CloseButton label={props.closeLabel} size="sm" onPress={props.onClose} />
            </div>
            <Text>{props.text}</Text>
            <div className={WELCOME_ACTIONS}>
                <Button variant="secondary" href={props.testHref}>
                    {props.testLabel}
                </Button>
                <Button variant="ghost" href={props.officeHref}>
                    {props.officeLabel}
                </Button>
            </div>
        </div>
    </SurfaceCard>
)
