import { Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { IconGlyph } from "@/components/leaves/Icon"
import type { IconGlyphName } from "@/components/leaves/Icon"

/** One scope fact: its glyph, a value and its explanation. */
interface LandingFactProps {
    readonly icon: IconGlyphName
    readonly title: string
    readonly text: string
}

/** One scope fact on its own top-level card, with a neutral identity tile. */
export const LandingFact = (props: LandingFactProps) => (
    <SurfaceCard height="fill">
        <Stack gap="row">
            <IconGlyph name={props.icon} isTile />
            <Text size="md" weight="semibold">
                {props.title}
            </Text>
            <Text size="sm" tone="muted">
                {props.text}
            </Text>
        </Stack>
    </SurfaceCard>
)
