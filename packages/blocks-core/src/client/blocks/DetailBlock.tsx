import { useState, type ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import {
    Alert,
    Button,
    Cluster,
    DescriptionList,
    Heading,
    IconButton,
    PinnedActionBar,
    Stack,
    SurfaceCard,
    Text,
    Timeline,
} from "@starci/grammar/common"
import { surfaceFrame } from "../composites/surfaceFrame"
import type { detailBlock } from "../../blocks/detail.block"
import { cellContextOf, type CellContext } from "../../rows/cell-format"
import { detailSectionsOf } from "../../rows/detail-sections"
import { detailTimelineOf, type DetailTimelineStep } from "../../rows/detail-timeline"
import { recordIdOf } from "../../rows/form-values"
import { refusalOf } from "../../rows/refusal"
import { relabeller } from "../../rows/value-labels"
import { textOf, valueAt } from "../../slots/paths"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** Whether a command is offered: always when the spec names no flag, otherwise only while the record's flag at that path is true. */
const isOfferedBy = (record: unknown, path: string | undefined): boolean =>
    path === undefined || valueAt(record, path) === true

/** Whether any command is both offered by the record and allowed to the member. */
const hasOfferedAction = (slots: DetailCommandsProps["slots"], showPrimary: boolean, showSecondary: boolean): boolean =>
    (showPrimary && slots.primary.isAllowed) || (showSecondary && slots.secondary.isAllowed)

/** What the command of a record is given: the action, its look, whether it waits for a record, and what runs it. */
interface RowActionProps {
    readonly action: ActionHandle
    /** Whether the record says this command may be offered now. */
    readonly isOffered: boolean
    readonly intent: "commit" | "alternative"
    readonly isDisabled: boolean
    readonly onRun: () => void
}

/** The one command of a record that a slot offers: a button that runs the action on the record's id. */
const RowAction = (props: RowActionProps): ReactNode =>
    props.isOffered && props.action.isAllowed ? (
        <Button
            intent={props.intent}
            isPending={props.action.isRunning}
            isDisabled={props.isDisabled}
            onPress={props.onRun}
        >
            {props.action.label}
        </Button>
    ) : null

/** What the head of a record is given: who it is, what kind of record, and how to close it. */
interface DetailHeadProps {
    readonly title: string
    readonly kind: string | null
    readonly closeLabel: string
    readonly onClose: (() => void) | null
    readonly isLoading: boolean
}

/** The head of a record: its title and kind, and a close control when the spec names the param that holds the chosen record. */
const DetailHead = (props: DetailHeadProps): ReactNode => (
    <Cluster gap="row" wrap={false} justify="between" align="start">
        <Stack gap="inline">
            <Heading level={2} isLoading={props.isLoading}>
                {props.title}
            </Heading>
            {props.kind === null ? null : (
                <Text size="sm" tone="muted">
                    {props.kind}
                </Text>
            )}
        </Stack>
        {props.onClose === null ? null : (
            <IconButton intent="dismiss" label={props.closeLabel} onPress={props.onClose} />
        )}
    </Cluster>
)

/** The command props of a record: its id, its two actions and what runs them. */
interface DetailCommandsProps {
    readonly id: string
    /** Whether the record says the primary command may be offered now. */
    readonly showPrimary: boolean
    /** Whether the record says the secondary command may be offered now. */
    readonly showSecondary: boolean
    readonly slots: RenderOf<typeof detailBlock>["slots"]
    readonly onRun: (action: ActionHandle, id: string) => void
}

/** The primary and the secondary command of a record, the primary first. */
const DetailCommands = (props: DetailCommandsProps): ReactNode => (
    <Cluster gap="inline" justify="start">
        <RowAction
            action={props.slots.primary}
            isOffered={props.showPrimary}
            intent="commit"
            isDisabled={props.id === ""}
            onRun={() => props.onRun(props.slots.primary, props.id)}
        />
        <RowAction
            action={props.slots.secondary}
            isOffered={props.showSecondary}
            intent="alternative"
            isDisabled={props.id === ""}
            onRun={() => props.onRun(props.slots.secondary, props.id)}
        />
    </Cluster>
)

/** What the origin of a record is given: the heading and the steps. */
interface DetailOriginProps {
    readonly title: string
    readonly steps: ReadonlyArray<DetailTimelineStep>
}

/** Where the record came from: a heading and its steps on a timeline, each marked done. */
const DetailOrigin = (props: DetailOriginProps): ReactNode =>
    props.steps.length === 0 ? null : (
        <Stack gap="row">
            <Heading level={3}>{props.title}</Heading>
            <Timeline
                label={props.title}
                items={props.steps.map((step) => ({
                    id: step.id,
                    title: step.text,
                    state: "affirmative",
                    ...(step.at === "" ? {} : { timeLabel: step.at }),
                    ...(step.note === "" ? {} : { description: step.note }),
                }))}
            />
        </Stack>
    )

/** What the groups of facts of a record are given: the record, the spec, and how the words and values are read. */
interface DetailFactsProps {
    readonly record: unknown
    readonly spec: RenderOf<typeof detailBlock>["props"]
    readonly context: CellContext
    readonly words: (text: SpecText) => string
    readonly isLoading: boolean
}

/** The groups of facts of a record, each under its heading. */
const DetailFacts = (props: DetailFactsProps): ReactNode =>
    detailSectionsOf(props.record, props.spec, props.context).map((section) => (
        <Stack key={section.id} gap="row">
            {section.title === null ? null : (
                <Heading level={3} isLoading={props.isLoading}>
                    {props.words(section.title)}
                </Heading>
            )}
            <DescriptionList
                layout="columns"
                isDivided
                isLoading={props.isLoading}
                items={section.items.map((item) => ({
                    id: item.id,
                    term: props.words(item.term),
                    description: item.text,
                }))}
            />
        </Stack>
    ))

/** What the notice of a refused command is given. */
interface DetailRefusalProps {
    /** The id of the record on show. */
    readonly id: string
    /** The refusal answered to a command and the id of the record it was answered for; null when none stands. */
    readonly refusal: { readonly id: string; readonly text: SpecText } | null
    readonly words: (text: SpecText) => string
    readonly onDismiss: () => void
}

/** The message of a refused command, in place above the facts, only for the record it was answered for. */
const DetailRefusal = (props: DetailRefusalProps): ReactNode =>
    props.refusal?.id !== props.id ? null : (
        <Alert
            tone="negative"
            title={props.words(props.refusal.text)}
            dismissLabel={props.words({ key: "alertDismiss" })}
            onDismiss={props.onDismiss}
        />
    )

/** What the filled detail is given: the record, the block, and how its words, values and commands work. */
interface DetailBodyProps {
    readonly record: unknown
    readonly isLoading: boolean
    readonly block: RenderOf<typeof detailBlock>
    readonly context: CellContext
    readonly words: (text: SpecText) => string
    /** The refusal answered to a command, if one stands, and the id of the record it was answered for. */
    readonly refusal: { readonly id: string; readonly text: SpecText } | null
    readonly onDismissRefusal: () => void
    readonly onRun: (action: ActionHandle, id: string) => void
}

/** The head, the facts, the origin and the commands of one record, in the card or with the commands pinned under it. */
const DetailBody = (props: DetailBodyProps): ReactNode => {
    const { block, words, record, isLoading } = props
    const spec = block.props
    const id = recordIdOf(record, spec.idPath ?? "id")
    const showPrimary = isOfferedBy(record, spec.primaryWhen)
    const showSecondary = isOfferedBy(record, spec.secondaryWhen)
    const hasActions = hasOfferedAction(block.slots, showPrimary, showSecondary)
    const commands = (
        <DetailCommands
            id={id}
            showPrimary={showPrimary}
            showSecondary={showSecondary}
            slots={block.slots}
            onRun={props.onRun}
        />
    )
    const isPinned = spec.pinsPrimary === true && !isLoading && hasActions
    const closeParam = spec.closeParam
    const body = (
        <Stack gap="section">
            {spec.titlePath === undefined ? null : (
                <DetailHead
                    title={textOf(valueAt(record, spec.titlePath))}
                    kind={spec.kind === undefined ? null : words(spec.kind)}
                    closeLabel={words({ key: "detailClose" })}
                    onClose={closeParam === undefined ? null : () => block.params.set(closeParam, null)}
                    isLoading={isLoading}
                />
            )}
            <DetailRefusal id={id} refusal={props.refusal} words={words} onDismiss={props.onDismissRefusal} />
            <DetailFacts record={record} spec={spec} context={props.context} words={words} isLoading={isLoading} />
            {spec.timeline === undefined ? null : (
                <DetailOrigin
                    title={words(spec.timeline.title)}
                    steps={detailTimelineOf(record, spec.timeline, props.context)}
                />
            )}
            {isLoading || !hasActions || isPinned ? null : commands}
        </Stack>
    )
    const frame =
        spec.titlePath === undefined ? (
            <SurfaceCard label={words(spec.label)} headingLevel={2} isLoading={isLoading}>
                {body}
            </SurfaceCard>
        ) : (
            <SurfaceCard ariaLabel={words(spec.label)} isLoading={isLoading}>
                {body}
            </SurfaceCard>
        )
    return (
        <>
            {frame}
            {isPinned ? (
                <PinnedActionBar label={words(spec.label)} visibility="always">
                    {commands}
                </PinnedActionBar>
            ) : null}
        </>
    )
}

/**
 * The facts of one bound record, in groups, with up to two commands on it; with no record chosen it says so. The head names the
 * record when the spec gives a title path, a timeline lists where it came from, and the commands stand pinned at the bottom of the
 * pane when the spec says so. A refusal or a conflict answered to a command shows its message in place, in an alert above the
 * facts, until the next command or its dismissal.
 */
export const DetailBlock = (props: RenderOf<typeof detailBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.idle ?? { key: "detailIdle" })
    const read = props.slots.record
    const context = cellContextOf(host.locale(), props.props.currency, relabeller(props.props.labels, words))
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
            frame={surfaceFrame({ label: words(props.props.label), headingLevel: 2 })}
            render={(record, isLoading) => (
                <DetailBody
                    record={record}
                    isLoading={isLoading}
                    block={props}
                    context={context}
                    words={words}
                    refusal={refusal}
                    onDismissRefusal={() => setRefusal(null)}
                    onRun={run}
                />
            )}
        />
    )
}
