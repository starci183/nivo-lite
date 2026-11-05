import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { Button, Cluster, DescriptionList, Heading, Stack, SurfaceCard } from "@starci/grammar/common"
import type { detailBlock } from "../../blocks/detail.block"
import { cellContextOf } from "../../rows/cell-format"
import { detailSectionsOf } from "../../rows/detail-sections"
import { recordIdOf } from "../../rows/form-values"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The one command of a record that a slot offers: a button that runs the action on the record's id. */
const RowAction = (props: {
    readonly action: ActionHandle
    readonly intent: "commit" | "alternative"
    readonly isDisabled: boolean
    readonly onRun: () => void
}): ReactNode =>
    props.action.isAllowed ? (
        <Button
            intent={props.intent}
            isPending={props.action.isRunning}
            isDisabled={props.isDisabled}
            onPress={props.onRun}
        >
            {props.action.label}
        </Button>
    ) : null

/** The facts of one bound record, in groups, with up to two commands on it; with no record chosen it says so. */
export const DetailBlock = (props: RenderOf<typeof detailBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.idle ?? { key: "detailIdle" })
    const read = props.slots.record
    const context = cellContextOf(host.locale(), props.props.currency)
    const hasActions = props.slots.primary.isAllowed || props.slots.secondary.isAllowed
    const run = (action: ActionHandle, id: string): void => {
        action
            .run({ id })
            .then((outcome) => {
                if (!outcome.ok) host.notify("danger", labels.error)
            })
            .catch(() => host.notify("danger", labels.error))
    }
    return (
        <SlotView
            slot={read.slot}
            labels={labels}
            placeholder={{}}
            onRetry={read.retry}
            render={(record, isLoading) => {
                const id = recordIdOf(record, props.props.idPath ?? "id")
                return (
                    <SurfaceCard label={words(props.props.label)} headingLevel={2} isLoading={isLoading}>
                        <Stack gap="section">
                            {detailSectionsOf(record, props.props, context).map((section) => (
                                <Stack key={section.id} gap="row">
                                    {section.title === null ? null : (
                                        <Heading level={3} isLoading={isLoading}>
                                            {words(section.title)}
                                        </Heading>
                                    )}
                                    <DescriptionList
                                        layout="columns"
                                        isDivided
                                        isLoading={isLoading}
                                        items={section.items.map((item) => ({
                                            id: item.id,
                                            term: words(item.term),
                                            description: item.text,
                                        }))}
                                    />
                                </Stack>
                            ))}
                            {isLoading || !hasActions ? null : (
                                <Cluster gap="inline" justify="end">
                                    <RowAction
                                        action={props.slots.secondary}
                                        intent="alternative"
                                        isDisabled={id === ""}
                                        onRun={() => run(props.slots.secondary, id)}
                                    />
                                    <RowAction
                                        action={props.slots.primary}
                                        intent="commit"
                                        isDisabled={id === ""}
                                        onRun={() => run(props.slots.primary, id)}
                                    />
                                </Cluster>
                            )}
                        </Stack>
                    </SurfaceCard>
                )
            }}
        />
    )
}
