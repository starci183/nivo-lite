import { Alert, Button, Heading, Region, SurfaceCard, TagGroup, Text, Textarea } from "@starci/grammar/common"
import { ACTIONS_CLASS, FACTS_CLASS, PRESERVE_LINES_CLASS, SECTION_CLASS } from "./classNames"

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
    <Region className={SECTION_CLASS} label={props.sectionLabel}>
        <div className={FACTS_CLASS}>
            <Heading level={3}>{props.title}</Heading>
            <Text size="sm" tone="muted">
                {props.help}
            </Text>
        </div>
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
            variant="secondary"
            rows={5}
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
        <div className={FACTS_CLASS}>
            <Text size="xs" tone="muted">
                {props.variablesTitle}
            </Text>
            <TagGroup
                label={props.variablesTitle}
                size="sm"
                items={props.variables.map((variable) => ({ id: variable, label: `{${variable}}` }))}
            />
        </div>
        <div className={ACTIONS_CLASS}>
            {props.enableLabel === undefined ? null : (
                <Button variant="primary" isPending={props.isBusy} isDisabled={!props.canEnable} onPress={props.onEnable}>
                    {props.enableLabel}
                </Button>
            )}
            <Button
                variant={props.isFirstApproval ? "secondary" : "primary"}
                isPending={props.isBusy}
                isDisabled={!props.canSave}
                onPress={props.onSave}
            >
                {props.saveLabel}
            </Button>
            <Button variant="outline" isPending={props.isComposing} isDisabled={props.isBusy} onPress={props.onCompose}>
                {props.composeLabel}
            </Button>
        </div>
        <div className={FACTS_CLASS}>
            <Text size="xs" tone="muted">
                {props.previewTitle}
            </Text>
            <SurfaceCard depth="nested" ariaLabel={props.previewTitle}>
                <div className={PRESERVE_LINES_CLASS}>
                    <Text size="sm">{props.previewText}</Text>
                </div>
            </SurfaceCard>
            {props.toneNote === undefined ? null : (
                <Text size="xs" tone="muted">
                    {props.toneNote}
                </Text>
            )}
        </div>
    </Region>
)
