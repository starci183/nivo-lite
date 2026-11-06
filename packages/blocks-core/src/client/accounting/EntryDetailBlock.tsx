import { useState } from "react"
import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import {
    Button,
    Cluster,
    Form,
    Heading,
    IconButton,
    PinnedActionBar,
    Stack,
    SurfaceCard,
    Text,
    Timeline,
} from "@starci/grammar/common"
import type { accountingEntryDetailBlock } from "../../blocks/accounting/entry-detail.block"
import { adjustTargetOf, entryRecord, entryTitleOf, stagesOf, stateKeyOf } from "../../rules/accounting/entry-stages"
import type { EntryRecord } from "../../rules/accounting/entry-stages"
import { parsedSlot } from "../../slots/slots"
import { FormFieldView } from "../composites/FormFieldView"
import type { FormFieldData } from "../composites/FormFieldView"
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

/** The entry of the books with where it came from and the correction the owner may add. */
export const EntryDetailBlock = (props: RenderOf<typeof accountingEntryDetailBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.idle)
    const [isAdjusting, setAdjusting] = useState(false)
    const read = props.slots.record
    const adjust = props.slots.adjust
    return (
        <SlotView
            slot={parsedSlot(read.slot, entryRecord)}
            labels={labels}
            placeholder={PLACEHOLDER}
            onRetry={read.retry}
            render={(entry, isLoading) => {
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
                const canAdjust = adjust.isAllowed && adjustTargetOf(entry) !== null && !isLoading
                return (
                    <>
                        <SurfaceCard ariaLabel={words(props.props.label)} isLoading={isLoading}>
                            <Stack gap="section">
                                <Cluster gap="row" wrap={false} justify="between" align="start">
                                    <Stack gap="inline">
                                        <Heading level={2} isLoading={isLoading}>
                                            {entryTitleOf(entry)}
                                        </Heading>
                                        <Text size="sm" tone="muted">
                                            {words(props.props.kind)}
                                        </Text>
                                    </Stack>
                                    <IconButton
                                        intent="dismiss"
                                        label={words({ key: "detailClose" })}
                                        onPress={() => props.params.set(props.props.closeParam, null)}
                                    />
                                </Cluster>
                                <Stack gap="row">
                                    <Heading level={3}>{words({ key: "lineage" })}</Heading>
                                    <Timeline
                                        label={words({ key: "lineage" })}
                                        isLoading={isLoading}
                                        items={stages.map((stage) => ({
                                            id: stage.id,
                                            title: stage.title,
                                            state: stage.isDone ? "affirmative" : "pending",
                                            description: stage.note,
                                        }))}
                                    />
                                </Stack>
                                <Stack gap="row">
                                    <Heading level={3}>{words({ key: "adjust_title" })}</Heading>
                                    <Text size="sm" tone="muted">
                                        {words({ key: "adjust_body" })}
                                    </Text>
                                </Stack>
                                {canAdjust && isAdjusting ? (
                                    <AdjustForm entry={entry} adjust={adjust} onDone={() => setAdjusting(false)} />
                                ) : null}
                            </Stack>
                        </SurfaceCard>
                        {canAdjust && !isAdjusting ? (
                            <PinnedActionBar label={words(props.props.label)} visibility="always">
                                <Button intent="commit" onPress={() => setAdjusting(true)}>
                                    {words({ key: "adjust_open" })}
                                </Button>
                            </PinnedActionBar>
                        ) : null}
                    </>
                )
            }}
        />
    )
}
