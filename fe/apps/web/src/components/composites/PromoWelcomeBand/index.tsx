import { Button, Cluster, Heading, Mascot, Stack, SurfaceCard, Text, IconButton } from "@starci/grammar/common"
import { WELCOME_COPY } from "./classNames"

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
        artwork={
            <Mascot
                src="/images/promo/mascot-celebrate.png"
                size="lg"
                assetSlot="promo-welcome-celebrate"
                assetSha256="52c3b94bc74a2dafdd7e394b4e2df383bedaa73d4a3dfaf42c566538c78ebc4e"
                assetPrompt="The NIVO unicorn celebrates with confetti, transparent ground"
            />
        }
    >
        <div className={WELCOME_COPY}>
            <Stack gap="section" align="start">
                <Cluster gap="row" align="start" justify="between" wrap={false}>
                    <Heading level={2}>{props.title}</Heading>
                    <IconButton intent="dismiss" label={props.closeLabel} size="sm" onPress={props.onClose} />
                </Cluster>
                <Text>{props.text}</Text>
                <Cluster gap="row">
                    <Button intent="neutral" href={props.testHref}>
                        {props.testLabel}
                    </Button>
                    <Button intent="neutral" href={props.officeHref}>
                        {props.officeLabel}
                    </Button>
                </Cluster>
            </Stack>
        </div>
    </SurfaceCard>
)
