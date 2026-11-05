import { Alert, Button, Quote, TagGroup, Text, Textarea, Section, Stack, Cluster } from "@starci/grammar/common"

/** What the message section shows, already in the reader language. */
type AutomationMessageProps = {
    readonly sectionLabel: string
    readonly title: string
    readonly help: string
    readonly staleAlert?: { readonly title: string; readonly body: string; readonly actionLabel: string }
    readonly bodyId: string
    readonly bodyLabel: string
    readonly bodyValue: string
    readonly maxLength: number
    readonly note?: string
    readonly variablesTitle: string
    readonly variables: ReadonlyArray<string>
    /** The label of "save and switch on" while no wording is approved; absent once one is. */
    readonly enableLabel?: string
    readonly saveLabel: string
    readonly composeLabel: string
    readonly previewTitle: string
    readonly previewText: string
    readonly toneNote?: string
    readonly isBusy: boolean
    readonly isComposing: boolean
    readonly canEnable: boolean
    readonly canSave: boolean
    readonly isFirstApproval: boolean
    readonly onChange: (value: string) => void
    readonly onEnable: () => void
    readonly onSave: () => void
    readonly onCompose: () => void
}

/** The approved wording: a proposal written from the shop context, editable, always reviewed and saved by the owner, with a live preview. */
export const AutomationMessage = (props: AutomationMessageProps) => (
    <Section
        title={props.title}
        description={props.help}
        headingLevel={3}
        action={
            <Button intent="neutral" isPending={props.isComposing} isDisabled={props.isBusy} onPress={props.onCompose}>
                {props.composeLabel}
            </Button>
        }
    >
        {props.staleAlert === undefined ? null : (
            <Alert
                title={props.staleAlert.title}
                description={props.staleAlert.body}
                tone="cautionary"
                action={{ label: props.staleAlert.actionLabel, onAction: props.onCompose }}
            />
        )}
        <Textarea
            id={props.bodyId}
            name="body"
            label={props.bodyLabel}
            rows={3}
            maxLength={props.maxLength}
            value={props.bodyValue}
            isDisabled={props.isBusy || props.isComposing}
            onValueChange={props.onChange}
        />
        {props.note === undefined ? null : (
            <Text size="xs" tone="muted">
                {props.note}
            </Text>
        )}
        <Stack gap="identity">
            <Text size="xs" tone="muted">
                {props.variablesTitle}
            </Text>
            <TagGroup
                label={props.variablesTitle}
                size="sm"
                items={props.variables.map((variable) => ({ id: variable, label: `{${variable}}` }))}
            />
        </Stack>
        <Stack gap="identity">
            <Quote source={props.previewTitle} text={props.previewText} />
            {props.toneNote === undefined ? null : (
                <Text size="xs" tone="muted">
                    {props.toneNote}
                </Text>
            )}
        </Stack>
        {renderAutomationMessageActions(props)}
    </Section>
)

/** Renders the AutomationMessage actions section. */
const renderAutomationMessageActions = (
    props: Pick<
        AutomationMessageProps,
        "enableLabel" | "isBusy" | "canEnable" | "onEnable" | "canSave" | "onSave" | "saveLabel"
    >,
) => (
    <Cluster gap="inline" justify="end">
        {props.enableLabel === undefined ? null : (
            <Button intent="commit" isPending={props.isBusy} isDisabled={!props.canEnable} onPress={props.onEnable}>
                {props.enableLabel}
            </Button>
        )}
        <Button
            intent={props.enableLabel === undefined ? "commit" : "alternative"}
            isPending={props.isBusy}
            isDisabled={!props.canSave}
            onPress={props.onSave}
        >
            {props.saveLabel}
        </Button>
    </Cluster>
)
