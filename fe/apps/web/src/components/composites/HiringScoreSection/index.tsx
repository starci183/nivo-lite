import type { HiringViews } from "@/modules/types"

import { Badge, Button, Cluster, DescriptionList, Quote, Section, Stack, Text } from "@starci/grammar/common"

/** The words and state of the screening section. */
interface HiringScoreSectionProps {
    readonly copy: HiringViews["workbenchCopy"]
    readonly score: HiringViews["candidateScore"] | null
    readonly isBusy: boolean
    readonly on: {
        readonly rescreen: () => void
    }
}

/** Screening stays in the candidate's existing drawer surface: a score fact, its source summary and the criterion rows. */
export const HiringScoreSection = (props: HiringScoreSectionProps) => {
    const { copy, score, isBusy } = props
    return (
        <Section title={copy.candScoreTitle} headingLevel={3}>
            {score === null ? (
                <Text tone="muted">{copy.candNotScreened}</Text>
            ) : (
                <>
                    <Cluster gap="inline" align="baseline">
                        <Text isStrong>{score.value}</Text>
                        <Badge tone={score.tone}>{score.label}</Badge>
                    </Cluster>
                    {score.summary === null ? null : <Quote source={copy.candSummary} text={score.summary} />}
                    <DescriptionList
                        layout="stacked"
                        items={score.reasons.map((reason) => ({
                            id: reason.id,
                            term: reason.criterion,
                            description: (
                                <Stack gap="identity">
                                    <Badge tone={reason.tone}>{reason.statusLabel}</Badge>
                                    <Text size="xs" tone="muted">
                                        {reason.note}
                                    </Text>
                                </Stack>
                            ),
                        }))}
                    />
                    <Text size="xs" tone="muted">
                        {copy.candScoreFair}
                    </Text>
                </>
            )}
            <Button intent="neutral" size="sm" isPending={isBusy} isDisabled={isBusy} onPress={props.on.rescreen}>
                {copy.candRescreen}
            </Button>
        </Section>
    )
}
