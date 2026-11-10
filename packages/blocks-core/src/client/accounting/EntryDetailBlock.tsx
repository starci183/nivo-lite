import { useState, type ReactNode } from "react"
import { SlotView, useAsideHead, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { Button, Cluster, Form, Heading, IconButton, Stack, Sublabel, SurfaceCard, Text } from "@starci/grammar/common"
import type { accountingEntryDetailBlock } from "../../blocks/accounting/entry-detail.block"
import {
    adjustTargetOf,
    entryRecord,
    entryTitleOf,
    stagesOf,
    stateKeyOf,
    type EntryRecord,
} from "../../rules/accounting/entry-stages"
import { moneyOf, orderCodeIn } from "../../rules/accounting/book-view"
import { SOURCE_ADJUSTMENT, SOURCE_INVOICE, SOURCE_TRANSACTION } from "../../rules/accounting/posting"
import { parsedSlot } from "../../slots/slots"
import { FormFieldView, type FormFieldData } from "../composites/FormFieldView"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import { useFormValues } from "../composites/useFormValues"
import type { RenderOf } from "../render-props"

/** The fields of the correction: why, and the amount that is right when the amount was wrong. */
const ADJUST_FIELDS: ReadonlyArray<FormFieldData> = [
    { name: "note", label: { key: "adjust_note_label" }, kind: "textarea", required: true, max: 1000 },
    { name: "correctedAmount", label: { key: "adjust_amount_label" }, kind: "money" },
]

/** The record shown while the first read is in flight. */
const PLACEHOLDER: EntryRecord = {
    id: "placeholder",
    note: "........",
    sourceEntity: "",
    sourceId: "",
    lineage: [],
}

/** What the head of an entry is given. */
interface EntryHeadProps {
    readonly title: string
    readonly kind: string
    readonly closeLabel: string
    readonly isLoading: boolean
    readonly onClose: () => void
}

/** The head of an entry: the aside pane draws it sticky when it can, else it is one row of the block, the name over its kind with a small close control. */
const EntryHead = (props: EntryHeadProps): ReactNode => {
    const isHosted = useAsideHead({
        title: props.title,
        description: props.kind,
        onClose: props.onClose,
        closeLabel: props.closeLabel,
    })
    if (isHosted) return null
    return (
        <Cluster gap="row" wrap={false} justify="between" align="start">
            <Stack gap="inline">
                <Heading level={3} isLoading={props.isLoading}>
                    {props.title}
                </Heading>
                <Text size="sm" tone="muted">
                    {props.kind}
                </Text>
            </Stack>
            <IconButton intent="dismiss" size="sm" label={props.closeLabel} onPress={props.onClose} />
        </Cluster>
    )
}

/** What the correction form is given. */
interface AdjustFormProps {
    readonly entry: EntryRecord
    readonly adjust: ActionHandle
    readonly onDone: () => void
}

/** The correction form: it adds a correction beside the entry's source record and closes when it is recorded. */
const AdjustForm = (props: AdjustFormProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const form = useFormValues(ADJUST_FIELDS, null)
    const send = (): void => {
        const values = form.check()
        if (values === null) return
        props.adjust
            .run({
                id: props.entry.id,
                values: { note: values.note ?? "", correctedAmount: values.correctedAmount ?? null },
            })
            .then((outcome) => {
                if (outcome.ok) {
                    host.notify("success", words({ key: "adjust_done" }))
                    props.onDone()
                } else if (outcome.reason === "invalid") form.answer(outcome.fields)
                else host.notify("danger", words(outcome.message))
            })
            .catch(() => host.notify("danger", words({ key: "slotError" })))
    }
    return (
        <Form
            label={words({ key: "adjust_form" })}
            validationBehavior="aria"
            isPending={props.adjust.isRunning}
            onSubmit={send}
        >
            {ADJUST_FIELDS.map((field) => {
                const error = form.errors[field.name]
                return (
                    <FormFieldView
                        key={field.name}
                        field={field}
                        value={form.values[field.name]}
                        error={error === undefined ? undefined : words(error)}
                        currency="VND"
                        isLoading={false}
                        isBusy={props.adjust.isRunning}
                        words={words}
                        onChange={(value) => form.change(field.name, value)}
                    />
                )
            })}
            <Cluster gap="inline" justify="start">
                <Button type="submit" intent="commit" isPending={props.adjust.isRunning}>
                    {words({ key: "adjust" })}
                </Button>
                <Button intent="neutral" onPress={props.onDone}>
                    {words({ key: "adjust_cancel" })}
                </Button>
            </Cluster>
        </Form>
    )
}

/** The words for the entity an entry comes from. */
const sourceWordOf = (entity: string, words: ReturnType<typeof useBlockWords>): string => {
    if (entity === SOURCE_TRANSACTION) return words({ key: "detail_source_transaction" })
    if (entity === SOURCE_INVOICE) return words({ key: "detail_source_invoice" })
    if (entity === SOURCE_ADJUSTMENT) return words({ key: "detail_source_adjustment" })
    return entity
}

/** What the facts of an entry are given. */
interface EntryFactsProps {
    readonly entry: EntryRecord
}

/** The facts of an entry in two groups: the amount (how much, from where, which order, the original text) and the history (each stage the money passed, with its state and day). */
const EntryFacts = (props: EntryFactsProps): ReactNode => {
    const words = useBlockWords()
    const { entry } = props
    const stages = stagesOf(entry.lineage, {
        names: {
            order: words({ key: "stage_order" }),
            invoice: words({ key: "stage_invoice" }),
            payment: words({ key: "stage_payment" }),
            adjustment: words({ key: "stage_adjustment" }),
        },
        missing: words({ key: "stage_missing" }),
        state: (kind, status) => {
            const key = stateKeyOf(kind, status)
            return key === undefined ? undefined : words({ key })
        },
    })
    const order = stages.find((stage) => stage.id !== "payment" && stage.isDone && stage.title.length > 0)
    const money = [
        ...(entry.amountVnd === undefined
            ? []
            : [{ id: "amount", key: words({ key: "detail_amount" }), value: moneyOf(entry.amountVnd) }]),
        { id: "source", key: words({ key: "detail_source" }), value: sourceWordOf(entry.sourceEntity, words) },
        { id: "order", key: words({ key: "detail_order" }), value: order?.title ?? words({ key: "detail_none" }) },
        ...(entry.note === undefined || entry.note === null || entry.note === ""
            ? []
            : [{ id: "note", key: words({ key: "detail_note" }), value: entry.note }]),
    ]
    const history = stages
        .filter((stage) => stage.isDone)
        .map((stage) => ({ id: stage.id, key: stage.title, value: stage.note }))
    const groups = [
        { id: "money", title: words({ key: "detail_group_money" }), items: money },
        { id: "history", title: words({ key: "detail_group_history" }), items: history },
    ]
    return groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
            <Stack key={group.id} gap="row">
                <Sublabel>{group.title}</Sublabel>
                <SurfaceCard
                    kind="list"
                    layout="keyValue"
                    ariaLabel={group.title}
                    isLoading={false}
                    items={group.items.map((item) => ({ id: item.id, title: item.key, value: item.value }))}
                    empty={null}
                />
            </Stack>
        ))
}

/** Asks for the ledger line of a payment again and says how it went; the read decides whether the control is offered at all. */
const useRepostSender = (repost: ActionHandle): ((paymentId: string) => void) => {
    const host = useBlockHost()
    const words = useBlockWords()
    return (paymentId) => {
        repost
            .run({ id: paymentId })
            .then((outcome) =>
                outcome.ok
                    ? host.notify("success", words({ key: "repost_done" }))
                    : host.notify("danger", words(outcome.message ?? { key: "repost_failed" })),
            )
            .catch(() => host.notify("danger", words({ key: "repost_failed" })))
    }
}

/** The entry of the books with where it came from, the correction the owner may add and the ledger line they may ask for again. */
export const EntryDetailBlock = (props: RenderOf<typeof accountingEntryDetailBlock>): ReactNode => {
    const words = useBlockWords()
    const sendRepost = useRepostSender(props.slots.repost)
    const labels = useSlotLabels(props.props.idle)
    const [isAdjusting, setIsAdjusting] = useState(false)
    const read = props.slots.record
    const adjust = props.slots.adjust
    const repost = props.slots.repost
    return (
        <SlotView
            slot={parsedSlot(read.slot, entryRecord)}
            labels={labels}
            placeholder={PLACEHOLDER}
            onRetry={read.retry}
            render={(entry, isLoading) => {
                const canAdjust = adjust.isAllowed && adjustTargetOf(entry) !== null && !isLoading
                const canRepost = repost.isAllowed && entry.canRepostLedger === true && !isLoading
                return (
                    <Stack gap="section">
                        <EntryHead
                            title={orderCodeIn(entryTitleOf(entry)) || entryTitleOf(entry)}
                            kind={words(props.props.kind)}
                            closeLabel={words({ key: "detailClose" })}
                            isLoading={isLoading}
                            onClose={() =>
                                props.params.setMany({
                                    [props.props.closeParam]: null,
                                    [props.props.paneParam]: "list",
                                })
                            }
                        />
                        <EntryFacts entry={entry} />
                        {canAdjust && isAdjusting ? (
                            <AdjustForm entry={entry} adjust={adjust} onDone={() => setIsAdjusting(false)} />
                        ) : null}
                        <Cluster gap="inline" justify="start">
                            {canAdjust && !isAdjusting ? (
                                <Button intent="neutral" size="sm" onPress={() => setIsAdjusting(true)}>
                                    {words({ key: "adjust_open" })}
                                </Button>
                            ) : null}
                            {canRepost ? (
                                <Button
                                    intent="neutral"
                                    size="sm"
                                    isPending={repost.isRunning}
                                    onPress={() => sendRepost(entry.sourceId)}
                                >
                                    {words({ key: "repost_open" })}
                                </Button>
                            ) : null}
                        </Cluster>
                    </Stack>
                )
            }}
        />
    )
}
