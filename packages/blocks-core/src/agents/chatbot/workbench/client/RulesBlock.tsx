import { useState, type ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Button, Form, Cluster, Stack, Text, Textarea } from "@starci/grammar/common"
import type { rulesBlock } from "../blocks/rules.block"
import { draftOf, rulesErrorsOf, valuesOf, type RulesDraft } from "../rows/rules-form"
import { HOLDING_MESSAGE_MAX } from "../../rules/settings"
import { textOf, valueAt } from "../../../../shared/slots/paths"
import { useBlockWords, useSlotLabels } from "../../../../shared/client/composites/useBlockWords"
import type { RenderOf } from "../../../../shared/client/render-props"

type RulesProps = RenderOf<typeof rulesBlock>

/** What the field of the settings is given. */
interface RulesFieldsProps {
    /** The values being typed. */
    readonly draft: RulesDraft
    /** Takes the values after a change. */
    readonly onDraft: (next: RulesDraft) => void
    /** True while the person may not change them. */
    readonly isLocked: boolean
    /** True while the settings are still being read. */
    readonly isLoading: boolean
    /** The refusal to show under a field, when it has one. */
    readonly errorOf: (field: string) => { readonly errorMessage?: string }
}

/** The field of the settings: what a customer is told while the model works. */
const RulesFields = (props: RulesFieldsProps): ReactNode => {
    const words = useBlockWords()
    return (
        <Textarea
            id="holdingMessage"
            name="holdingMessage"
            label={words({ key: "rules_holding_label" })}
            description={words({ key: "rules_holding_hint" })}
            isLoading={props.isLoading}
            isReadOnly={props.isLocked}
            rows={3}
            maxLength={HOLDING_MESSAGE_MAX}
            value={props.draft.holdingMessage}
            onValueChange={(holdingMessage) => props.onDraft({ ...props.draft, holdingMessage })}
            {...props.errorOf("holdingMessage")}
        />
    )
}

/** What the form over the settings is given: the block's props and the record it starts from. */
interface RulesFormProps extends RulesProps {
    readonly record: unknown
    readonly isLoading: boolean
}

/** The form over the settings a record holds: it starts from them again whenever the record changes. */
const RulesForm = (props: RulesFormProps): ReactNode => {
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
        <Stack gap="row">
                <Form
                    label={words({ key: "rules_title" })}
                    validationBehavior="aria"
                    isPending={save.isRunning}
                    onSubmit={submit}
                >
                    <RulesFields
                        draft={draft}
                        onDraft={setDraft}
                        isLocked={!save.isAllowed || save.isRunning}
                        isLoading={props.isLoading}
                        errorOf={errorOf}
                    />
                    {save.isAllowed ? (
                        <Cluster gap="inline" justify="end">
                            <Button
                                intent="neutral"
                                isDisabled={save.isRunning}
                                onPress={() => {
                                    setDraft(draftOf(props.record))
                                    setShown({})
                                }}
                            >
                                {words({ key: "agentMessageCancel" })}
                            </Button>
                            <Button
                                type="submit"
                                intent="commit"
                                isPending={save.isRunning}
                                isLoading={props.isLoading}
                            >
                                {words({ key: "rules_submit" })}
                            </Button>
                        </Cluster>
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
    )
}

/** The rules form of the Chatbot: its settings in the states of the settings read, saved by the bound action. */
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
