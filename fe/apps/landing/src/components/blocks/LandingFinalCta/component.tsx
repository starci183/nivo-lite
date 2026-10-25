import { Button, Heading, PageContainer, Region, SurfaceCard, Text } from "@starci/grammar/common"
import { CTA_COPY } from "./classNames"

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
 * Final call to action on the grammar's ink band.
 *
 * Grammar gap: the ink band paints the accent colour, which is also what a primary button fills with, so a
 * primary action would be accent on accent. The band's one action takes the secondary variant until the
 * grammar ships an on-ink primary action treatment.
 */
export const LandingFinalCtaBase = (props: LandingFinalCtaBaseProps) => (
    <Region label={props.props.regionLabel}>
        <PageContainer measure="product">
            <SurfaceCard treatment="ink">
                <div className={CTA_COPY}>
                    <Heading level={2}>{props.props.title}</Heading>
                    <Text>{props.props.text}</Text>
                    <Button intent="neutral" size="lg" href={props.props.buttonHref}>
                        {props.props.buttonLabel}
                    </Button>
                    <Text size="xs">{props.props.note}</Text>
                </div>
            </SurfaceCard>
        </PageContainer>
    </Region>
)
