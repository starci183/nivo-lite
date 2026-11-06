import { useState } from "react"
import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Button, Form, NumberField, Stack, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import type { rulesBlock } from "../../blocks/chatbot/rules.block"
import { draftOf, rulesErrorsOf, valuesOf } from "../../rows/chatbot/rules-form"
import type { RulesDraft } from "../../rows/chatbot/rules-form"
import { HOLDING_MESSAGE_MAX, TIMEOUT_MAX_SEC, TIMEOUT_MIN_SEC } from "../../rules/chatbot/settings"
import { textOf, valueAt } from "../../slots/paths"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

type RulesProps = RenderOf<typeof rulesBlock>

/** The form over the settings a record holds: it starts from them again whenever the record changes. */
const RulesForm = (props: RulesProps & { readonly record: unknown; readonly isLoading: boolean }): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const [draft, setDraft] = useState<RulesDraft>(() => draftOf(props.record))
    const [shown, setShown] = useState<Readonly<Record<string, string>>>({})
    const { save } = props.slots
    const lastEdit = textOf(valueAt(props.record, "updatedBy"))
    const submit = (): void => {
        const found = rulesErrorsOf(draft)
        setShown(found)
        if (Object.keys(found).length > 0) return
        save.run({ id: "chatbot", values: { ...valuesOf(draft) } })
            .then((outcome) => {
                if (outcome.ok) host.notify("success", words({ key: "rules_saved" }))
                else if (outcome.reason === "invalid")
                    setShown(
                        Object.fromEntries(Object.entries(outcome.fields).map(([name, text]) => [name, words(text)])),
                    )
                else host.notify("danger", words(outcome.message))
            })
            .catch(() => host.notify("danger", words({ key: "approval_failed" })))
    }
    const errorOf = (field: string): { readonly errorMessage?: string } => {
        const key = shown[field]
        return key === undefined ? {} : { errorMessage: key.startsWith("rules_error_") ? words({ key }) : key }
    }
    return (
        <SurfaceCard label={words({ key: "rules_title" })} headingLevel={2}>
            <Stack gap="row">
                <Text size="sm" tone="muted">
                    {words({ key: "rules_intro" })}
                </Text>
                <Form
                    label={words({ key: "rules_title" })}
                    validationBehavior="aria"
                    isPending={save.isRunning}
                    onSubmit={submit}
                >
                    <NumberField
                        id="openclawTimeoutSec"
                        name="openclawTimeoutSec"
                        label={words({ key: "rules_timeout_label" })}
                        description={words({ key: "rules_timeout_hint" })}
                        isLoading={props.isLoading}
                        isReadOnly={!save.isAllowed || save.isRunning}
                        minValue={TIMEOUT_MIN_SEC}
                        maxValue={TIMEOUT_MAX_SEC}
                        formatOptions={{ style: "unit", unit: "second", unitDisplay: "long" }}
                        value={draft.openclawTimeoutSec ?? Number.NaN}
                        onValueChange={(reported) =>
                            setDraft({ ...draft, openclawTimeoutSec: Number.isNaN(reported) ? null : reported })
                        }
                        {...errorOf("openclawTimeoutSec")}
                    />
                    <Textarea
                        id="holdingMessage"
                        name="holdingMessage"
                        label={words({ key: "rules_holding_label" })}
                        description={words({ key: "rules_holding_hint" })}
                        isLoading={props.isLoading}
                        isReadOnly={!save.isAllowed || save.isRunning}
                        rows={3}
                        maxLength={HOLDING_MESSAGE_MAX}
                        value={draft.holdingMessage}
                        onValueChange={(holdingMessage) => setDraft({ ...draft, holdingMessage })}
                        {...errorOf("holdingMessage")}
                    />
                    {save.isAllowed ? (
                        <Button
                            type="submit"
                            intent="commit"
                            width="fill-narrow"
                            isPending={save.isRunning}
                            isLoading={props.isLoading}
                        >
                            {words({ key: "rules_submit" })}
                        </Button>
                    ) : (
                        <Text size="sm" tone="muted">
                            {words({ key: "rules_read_only" })}
                        </Text>
                    )}
                    {lastEdit === "" ? null : (
                        <Text size="sm" tone="muted">
                            {`${words({ key: "rules_last_edit_prefix" })}${lastEdit}`}
                        </Text>
                    )}
                </Form>
            </Stack>
        </SurfaceCard>
    )
}

/** The "Quy tắc" form of the Chatbot: its settings in the states of the settings read, saved by the bound action. */
export const RulesBlock = (props: RulesProps): ReactNode => {
    const labels = useSlotLabels()
    const read = props.slots.settings
    return (
        <SlotView
            slot={read.slot}
            labels={labels}
            placeholder={{}}
            onRetry={read.retry}
            render={(record, isLoading) => (
                <RulesForm key={JSON.stringify(record)} {...props} record={record} isLoading={isLoading} />
            )}
        />
    )
}
