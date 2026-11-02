import { Button, Stack, SurfaceCard, Text } from "@starci/grammar/common"

/** The resolved words the final call to action draws. */
interface LandingFinalCtaBaseProps {
    readonly props: {
        readonly regionLabel: string
        readonly title: string
        readonly text: string
        readonly buttonLabel: string
        readonly buttonHref: string
        readonly note: string
    }
}

/**
 * The final destination and its reassurance on the grammar's ink band, inside the landing Page's measure.
 */
export const LandingFinalCtaBase = (props: LandingFinalCtaBaseProps) => (
    <SurfaceCard label={props.props.title} ariaLabel={props.props.regionLabel} headingLevel={2} treatment="ink">
        <Stack gap="section" align="start" measure="reading">
            <Text>{props.props.text}</Text>
            <Button intent="neutral" href={props.props.buttonHref}>
                {props.props.buttonLabel}
            </Button>
            <Text size="xs">{props.props.note}</Text>
        </Stack>
    </SurfaceCard>
)
