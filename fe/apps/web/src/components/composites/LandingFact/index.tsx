import { SurfaceCard, Text } from "@starci/grammar/common"
import { LandingIconTile, type IconName } from "@/components/leaves/Icon"
import { FACT_BODY } from "./classNames"

/** One scope fact: its glyph, a value and its explanation. */
interface LandingFactProps {
    readonly icon: IconName
    readonly title: string
    readonly text: string
}

/** One scope fact on its own top-level card, with a neutral identity tile. */
export const LandingFact = (props: LandingFactProps) => (
    <SurfaceCard height="fill">
        <div className={FACT_BODY}>
            <LandingIconTile name={props.icon} />
            <Text size="md" weight="semibold">
                {props.title}
            </Text>
            <Text size="sm" tone="muted">
                {props.text}
            </Text>
        </div>
    </SurfaceCard>
)
