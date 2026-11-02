import { Grid, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { IconGlyph, type IconGlyphName } from "@/components/leaves/Icon"

/** One situation the product watches. */
interface LandingTrustChip {
    readonly id: string
    readonly label: string
    readonly icon: IconGlyphName
}

/** The resolved words the trust strip draws. */
interface LandingTrustStripBaseProps {
    readonly props: {
        readonly lead: string
        readonly forLabel: string
        readonly audience: string
        readonly sub: string
        readonly chips: ReadonlyArray<LandingTrustChip>
    }
}

/** Who the product is for plus the situations it watches, on one top-level card. */
export const LandingTrustStripBase = (props: LandingTrustStripBaseProps) => {
    const chips = props.props.chips.map((chip) => ({
        id: chip.id,
        label: chip.label,
        iconProps: { name: chip.icon, usage: "leading" } as const,
    }))
    return (
        <Stack gap="section">
            <Text tone="muted">{props.props.lead}</Text>
            <SurfaceCard label={props.props.forLabel} headingLevel={2}>
                <Grid
                    kind="pair"
                    leading={
                        <Stack gap="identity">
                            <Text size="md" isStrong>
                                {props.props.audience}
                            </Text>
                            <Text size="sm" tone="muted">
                                {props.props.sub}
                            </Text>
                        </Stack>
                    }
                    trailing={
                        <Grid kind="sections">
                            {chips.map((chip) => (
                                <Text key={chip.id} size="sm" startContent={<IconGlyph {...chip.iconProps} />}>
                                    {chip.label}
                                </Text>
                            ))}
                        </Grid>
                    }
                />
            </SurfaceCard>
        </Stack>
    )
}
