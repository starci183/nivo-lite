import { useState } from "react"
import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { Alert, Button, Cluster, DescriptionList, Heading, Stack, SurfaceCard } from "@starci/grammar/common"
import type { detailBlock } from "../../blocks/detail.block"
import { cellContextOf } from "../../rows/cell-format"
import { detailSectionsOf } from "../../rows/detail-sections"
import { recordIdOf } from "../../rows/form-values"
import { refusalOf } from "../../rows/refusal"
import { relabeller } from "../../rows/value-labels"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** What the command of a record is given: the action, its look, whether it waits for a record, and what runs it. */
interface RowActionProps {
    readonly action: ActionHandle
    readonly intent: "commit" | "alternative"
    readonly isDisabled: boolean
    readonly onRun: () => void
}

/** The one command of a record that a slot offers: a button that runs the action on the record's id. */
const RowAction = (props: RowActionProps): ReactNode =>
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

/**
 * The facts of one bound record, in groups, with up to two commands on it; with no record chosen it says so. A refusal or a
 * conflict answered to a command shows its message in place, in an alert above the facts, until the next command or its dismissal.
 */
export const DetailBlock = (props: RenderOf<typeof detailBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.idle ?? { key: "detailIdle" })
    const read = props.slots.record
    const context = cellContextOf(host.locale(), props.props.currency, relabeller(props.props.labels, words))
    const hasActions = props.slots.primary.isAllowed || props.slots.secondary.isAllowed
    const [refusal, setRefusal] = useState<{ readonly id: string; readonly text: SpecText } | null>(null)
    const run = (action: ActionHandle, id: string): void => {
        setRefusal(null)
        action
            .run({ id })
            .then((outcome) => {
                const refused = refusalOf(outcome)
                if (refused !== null) setRefusal({ id, text: refused })
                else if (!outcome.ok) host.notify("danger", labels.error)
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
                            {refusal?.id !== id ? null : (
                                <Alert
                                    tone="negative"
                                    title={words(refusal.text)}
                                    dismissLabel={words({ key: "alertDismiss" })}
                                    onDismiss={() => setRefusal(null)}
                                />
                            )}
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
                                <Cluster gap="inline" justify="start">
                                    <RowAction
                                        action={props.slots.primary}
                                        intent="commit"
                                        isDisabled={id === ""}
                                        onRun={() => run(props.slots.primary, id)}
                                    />
                                    <RowAction
                                        action={props.slots.secondary}
                                        intent="alternative"
                                        isDisabled={id === ""}
                                        onRun={() => run(props.slots.secondary, id)}
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
