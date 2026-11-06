import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Cluster, Heading, Stack, Text } from "@starci/grammar/common"
import type { accountingAgeingBlock } from "../../blocks/accounting/ageing.block"
import { ageingOf, figuresRecord } from "../../rules/accounting/overview-view"
import type { FiguresRecord } from "../../rules/accounting/overview-view"
import { parsedSlot } from "../../slots/slots"
import { FiguresProportion } from "../composites/FiguresStrip"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The figures shown while the first read is in flight. */
const PLACEHOLDER: FiguresRecord = {
    periodKey: "this",
    income: { vnd: 0, count: 0 },
    receivable: { vnd: 0, count: 0 },
    unmatched: { vnd: 0, count: 0 },
    ageing: { d0: { count: 0 }, d30: { count: 0 }, d60: { count: 0 } },
}

/** The open invoices by age, under a head that says how many are open. */
export const AgeingBlock = (props: RenderOf<typeof accountingAgeingBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const read = props.slots.figures
    return (
        <SlotView
            slot={parsedSlot(read.slot, figuresRecord)}
            labels={labels}
            placeholder={PLACEHOLDER}
            onRetry={read.retry}
            render={(figures, isLoading) => {
                const ageing = ageingOf(figures, {
                    buckets: [words({ key: "ageing_d0" }), words({ key: "ageing_d30" }), words({ key: "ageing_d60" })],
                    total: words({ key: "ageing_total" }),
                    count: words({ key: "ageing_count" }),
                })
                return (
                    <Stack gap="row">
                        <Cluster gap="inline" align="center">
                            <Heading level={3}>{words(props.props.title)}</Heading>
                            <Text size="sm" tone="muted">
                                {ageing.total}
                            </Text>
                        </Cluster>
                        <FiguresProportion
                            points={ageing.points}
                            empty={labels.empty}
                            isLoading={isLoading}
                            caption=""
                        />
                    </Stack>
                )
            }}
        />
    )
}
