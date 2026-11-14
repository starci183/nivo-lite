import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AlertDialog, Button, ComboBox, Grid, Input, Select, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { ReactElement } from "react"
import type {
    ConnectionFormActionView,
    ConnectionFormFieldView,
    ConnectionFormView,
    DataSlot,
    SlotLabels,
} from "@/modules/types"

/** The words of the Connection card, in the reader's language. */
export interface ConnectionFormCardWords {
    readonly title: string
    readonly nameLabel: string
    readonly sealedHint: string
    readonly choicePlaceholder: string
    readonly copyLabel: string
    readonly copiedLabel: string
    readonly confirmTitle: string
    readonly confirmLabel: string
    readonly cancelLabel: string
}

/** The words, the read and the commands of the Connection card of an account's Config tab. */
export interface ConnectionFormCardBaseProps {
    readonly props: {
        readonly words: ConnectionFormCardWords
        readonly slot: DataSlot<ConnectionFormView>
        readonly placeholder: ConnectionFormView
        readonly slotLabels: SlotLabels
        readonly isDisabled: boolean
        /** The action that is running, if one is. */
        readonly runningAction: string | null
        /** The question open before a save or an action goes: its words and whether the answer is on its way. */
        readonly question: { readonly description: string; readonly isPending: boolean } | null
    }
    readonly on: {
        readonly name: (value: string) => void
        readonly field: (key: string, value: string) => void
        readonly input: (action: string, key: string, value: string) => void
        readonly run: (action: string) => void
        readonly answerYes: () => void
        readonly answerNo: () => void
        readonly retry: () => void
    }
}

/** The props every control of the card shares: its error, as the field's own message. */
const errorOf = (error: string | null) => (error === null ? {} : { isInvalid: true, errorMessage: error })

/** The words under a field: the API's guidance, and for a sealed secret the line that it is kept and not shown again. */
const descriptionOf = (field: ConnectionFormFieldView, sealedHint: string) => {
    const lines = [field.guidance, field.kind === "secret" && field.isSealed ? sealedHint : null].filter(
        (line): line is string => line !== null,
    )
    return lines.length === 0 ? {} : { description: lines.join(" ") }
}

/** One declared field (or one input of an action): a picker for a choice, an empty sealed input for a secret, a read-only copyable input for an identity. */
const fieldOf = (
    field: ConnectionFormFieldView,
    words: ConnectionFormCardWords,
    isDisabled: boolean,
    isLoading: boolean,
    on: (key: string, value: string) => void,
): ReactElement => {
    if (field.kind === "choice") {
        const options = field.choices.map((choice) => ({ id: choice.id, label: choice.label }))
        const shared = {
            label: field.label,
            placeholder: words.choicePlaceholder,
            isRequired: field.isRequired,
            isDisabled: field.isReadOnly || isDisabled,
            isLoading,
            value: field.value === "" ? null : field.value,
            onValueChange: (value: string | null) => on(field.key, value ?? ""),
            options,
            ...descriptionOf(field, words.sealedHint),
            ...errorOf(field.error),
        }
        return field.isSearchable ? <ComboBox key={field.key} {...shared} /> : <Select key={field.key} {...shared} />
    }
    const isIdentity = field.kind === "identity"
    return (
        <Input
            key={field.key}
            id={`connection-field-${field.key}`}
            name={field.key}
            label={field.label}
            kind={field.kind === "secret" ? "newPassword" : "text"}
            value={field.value}
            isRequired={field.isRequired}
            isReadOnly={field.isReadOnly || isIdentity}
            isDisabled={isDisabled}
            isLoading={isLoading}
            onValueChange={(value) => on(field.key, value)}
            {...(field.isCopyable ? { isCopyable: true, copyLabel: words.copyLabel, copiedLabel: words.copiedLabel } : {})}
            {...descriptionOf(field, words.sealedHint)}
            {...errorOf(field.error)}
        />
    )
}

/** One action of the form: its inputs, a neutral command disabled unless the API says it can run, its guidance and the lines of its last run. */
const actionOf = (action: ConnectionFormActionView, props: ConnectionFormCardBaseProps, isLoading: boolean): ReactElement => (
    <Stack key={action.key} gap="inline">
        {action.inputs.length === 0 ? null : (
            <Grid kind="form" columns={1}>
                {action.inputs.map((input) =>
                    fieldOf(input, props.props.words, props.props.isDisabled, isLoading, (key, value) =>
                        props.on.input(action.key, key, value),
                    ),
                )}
            </Grid>
        )}
        <Button
            intent="neutral"
            size="sm"
            isDisabled={!action.canRun || props.props.isDisabled || isLoading}
            isPending={props.props.runningAction === action.key}
            onPress={() => props.on.run(action.key)}
        >
            {action.label}
        </Button>
        {action.results.map((result) => (
            <Text key={result.key} size="xs" tone="muted">
                {`${result.label}: ${result.value}`}
            </Text>
        ))}
        {action.guidance === null || action.results.length === 0 ? null : (
            <Text size="xs" tone="muted">
                {action.guidance}
            </Text>
        )}
    </Stack>
)

/**
 * The one surface of the Config tab: the Connection card with the display name and the fields the provider declares, in the
 * API's order (text, a searchable picker for a long choice, an empty sealed input for a secret, a read-only copyable input for an
 * identity), the words under the title and under each field, and the form's own commands as neutral buttons in the card's footer. A
 * chosen option that asks a question first opens the dialog before "Save" sends it. Labels, choices, limits and words are the API's.
 */
export const ConnectionFormCardBase = (props: ConnectionFormCardBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(view, isLoading) => (
            <>
                <SurfaceCard
                    label={props.props.words.title}
                    headingLevel={2}
                    isLoading={isLoading}
                    {...(view.notice === null
                        ? {}
                        : {
                              note: (
                                  <Text size="xs" tone="muted">
                                      {view.notice}
                                  </Text>
                              ),
                          })}
                    {...(view.actions.length === 0
                        ? {}
                        : {
                              footers: [
                                  {
                                      kind: "custom" as const,
                                      children: (
                                          <Stack gap="row">
                                              {view.actions.map((action) => actionOf(action, props, isLoading))}
                                          </Stack>
                                      ),
                                  },
                              ],
                          })}
                >
                    <Stack gap="row">
                        {view.guidance === null ? null : (
                            <Text size="xs" tone="muted">
                                {view.guidance}
                            </Text>
                        )}
                        <Grid kind="form" columns={1}>
                            <Input
                                id="connection-display-name"
                                name="displayName"
                                label={props.props.words.nameLabel}
                                value={view.name.value}
                                isReadOnly={view.name.isReadOnly}
                                isDisabled={props.props.isDisabled}
                                isLoading={isLoading}
                                onValueChange={props.on.name}
                                {...errorOf(view.name.error)}
                            />
                            {view.fields.map((field) =>
                                fieldOf(field, props.props.words, props.props.isDisabled, isLoading, props.on.field),
                            )}
                        </Grid>
                    </Stack>
                </SurfaceCard>
                <AlertDialog
                    isOpen={props.props.question !== null}
                    onOpenChange={(open) => {
                        if (!open) props.on.answerNo()
                    }}
                    title={props.props.words.confirmTitle}
                    description={props.props.question?.description ?? ""}
                    confirmLabel={props.props.words.confirmLabel}
                    cancelLabel={props.props.words.cancelLabel}
                    onConfirm={props.on.answerYes}
                    isConfirmPending={props.props.question?.isPending === true}
                />
            </>
        )}
    />
)
