import { Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { OverviewPaneCopy, OverviewPaneReady } from "@/modules/types"

/** What the week card draws. */
interface OverviewWeekCardProps {
    readonly data: OverviewPaneReady["week"]
    readonly copy: OverviewPaneCopy
    readonly isLoading: boolean
}

/** The last seven days: what NIVO did and asked and how fast the owner decides, over the five counts, in one card. */
export const OverviewWeekCard = (props: OverviewWeekCardProps) => (
    <SurfaceCard
        kind="bands"
        label={props.copy.weekTitle}
        headingLevel={2}
        fact={props.data.checked}
        isLoading={props.isLoading}
        bands={[
            {
                kind: "body",
                children: (
                    <Stack gap="identity">
                        <Text isStrong isLoading={props.isLoading}>
                            {props.data.sentence}
                        </Text>
                        <Text size="sm" tone="muted" isLoading={props.isLoading}>
                            {props.data.median}
                        </Text>
                    </Stack>
                ),
            },
            { kind: "figures", items: props.data.figures },
        ]}
    />
)
