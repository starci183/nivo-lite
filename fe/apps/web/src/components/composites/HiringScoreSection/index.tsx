import { Badge, Button, Heading, List, ListItem, SurfaceCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import type { HiringSay } from "@/hooks/hiring"
import {
    ACTIONS_CLASS_NAME,
    PAIR_CLASS_NAME,
    PRE_WRAP_CLASS_NAME,
    REASONS_CLASS_NAME,
    REASON_CLASS_NAME,
    SCORE_CLASS_NAME,
} from "./classNames"

/** The screening of the candidate, every word already resolved. */
interface ScoreView {
    readonly value: string
    readonly label: string
    readonly tone: BadgeTone
    readonly summary: string | null
    readonly reasons: ReadonlyArray<{
        readonly id: string
        readonly criterion: string
        readonly note: string
        readonly statusLabel: string
        readonly tone: BadgeTone
    }>
}

/** The words and state of the screening section. */
export interface HiringScoreSectionProps {
    readonly props: {
        readonly say: HiringSay
        /** Null while the candidate has not been screened. */
        readonly score: ScoreView | null
        readonly isBusy: boolean
    }
    readonly on: {
        readonly rescreen: () => void
    }
}

/** The screening section of a candidate: the advisory score, the lines behind it, and the button that screens again. */
export const HiringScoreSection = (props: HiringScoreSectionProps) => {
    const { say, score, isBusy } = props.props
    return (
        <>
            <Heading level={3}>{say("candScoreTitle")}</Heading>
            {score === null ? (
                <Text tone="muted">{say("candNotScreened")}</Text>
            ) : (
                <>
                    <div className={SCORE_CLASS_NAME}>
                        <Text size="metric-lead" weight="semibold">
                            {score.value}
                        </Text>
                        <Badge tone={score.tone}>{score.label}</Badge>
                    </div>
                    {score.summary === null ? null : (
                        <SurfaceCard depth="nested" ariaLabel={say("candSummary")}>
                            <div className={PRE_WRAP_CLASS_NAME}>
                                <Text as="p" size="sm">
                                    {score.summary}
                                </Text>
                            </div>
                        </SurfaceCard>
                    )}
                    <List className={REASONS_CLASS_NAME}>
                        {score.reasons.map((reason) => (
                            <ListItem key={reason.id} className={REASON_CLASS_NAME}>
                                <Badge tone={reason.tone}>{reason.statusLabel}</Badge>
                                <div className={PAIR_CLASS_NAME}>
                                    <Text size="sm" weight="medium">
                                        {reason.criterion}
                                    </Text>
                                    <Text size="xs" tone="muted">
                                        {reason.note}
                                    </Text>
                                </div>
                            </ListItem>
                        ))}
                    </List>
                    <Text size="xs" tone="muted">
                        {say("candScoreFair")}
                    </Text>
                </>
            )}
            <div className={ACTIONS_CLASS_NAME}>
                <Button
                    variant="secondary"
                    size="sm"
                    isPending={isBusy}
                    isDisabled={isBusy}
                    onPress={props.on.rescreen}
                >
                    {say("candRescreen")}
                </Button>
            </div>
        </>
    )
}
