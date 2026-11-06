import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Cluster, Heading, Stack } from "@starci/grammar/common"
import type { accountingWeeklyBlock } from "../../blocks/accounting/weekly.block"
import { bookPeriodOf } from "../../rules/accounting/book-view"
import { monthOf, weekBarsOf, weeklyRecord } from "../../rules/accounting/weekly-view"
import type { WeeklyRecord } from "../../rules/accounting/weekly-view"
import { parsedSlot } from "../../slots/slots"
import { FiguresBars } from "../composites/FiguresStrip"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"
import { PeriodControl } from "./PeriodControl"

/** The weeks shown while the first read is in flight. */
const PLACEHOLDER: WeeklyRecord = { periodKey: "this", fromDay: "2026-01-01", w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 }

/** The income by week of a month, with the control that switches to the month before. */
export const WeeklyBlock = (props: RenderOf<typeof accountingWeeklyBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const read = props.slots.weekly
    return (
        <Stack gap="row">
            <SlotView
                slot={parsedSlot(read.slot, weeklyRecord)}
                labels={labels}
                placeholder={PLACEHOLDER}
                onRetry={read.retry}
                render={(weekly, isLoading) => (
                    <Stack gap="row">
                        <Cluster gap="inline" justify="between" align="center">
                            <Heading
                                level={3}
                            >{`${words(props.props.title)}, ${words({ key: "weekly_period" })} ${monthOf(weekly.fromDay)}`}</Heading>
                            <PeriodControl
                                period={bookPeriodOf(props.params.value(props.props.periodParam))}
                                onChange={(period) =>
                                    props.params.set(props.props.periodParam, period === "last" ? "last" : null)
                                }
                            />
                        </Cluster>
                        <FiguresBars
                            label={words(props.props.title)}
                            points={weekBarsOf(weekly, (position) => words({ key: `week_w${position}` }))}
                            empty={labels.empty}
                            isLoading={isLoading}
                            caption={words(props.props.caption)}
                        />
                    </Stack>
                )}
            />
        </Stack>
    )
}
