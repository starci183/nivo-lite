import { Alert, Button, CheckboxGroup, Input, Select, Stack, Text, Textarea } from "@starci/grammar/common"
import type { Pillar, ContentViews } from "@/modules/types"

/** Props of {@link ContentEditorDetails}. */
interface ContentEditorDetailsProps {
    readonly title: string
    readonly brief: string
    readonly pillarId: string | null
    readonly channels: ReadonlyArray<string>
    readonly channelOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly date: string
    readonly time: string
    readonly pillars: ReadonlyArray<Pillar>
    readonly hint: string
    readonly warnings: ReadonlyArray<string>
    readonly isEditable: boolean
    readonly isDateLocked: boolean
    readonly isPending: boolean
    readonly isDrafting: boolean
    readonly hasDraftText: boolean
    readonly copy: ContentViews["workbenchCopy"]
    readonly onTitle: (v: string) => void
    readonly onBrief: (v: string) => void
    readonly onPillar: (id: string | null) => void
    readonly onChannels: (values: ReadonlyArray<string>) => void
    readonly onDate: (v: string) => void
    readonly onTime: (v: string) => void
    readonly onHint: (v: string) => void
    readonly onDraft: () => void
}

/** The details of a post in one column: title, idea, theme, channels, date and time, the AI draft request and the findings to check. */
export const ContentEditorDetails = (props: ContentEditorDetailsProps) => {
    const { copy } = props
    const locked = !props.isEditable || props.isPending
    return (
        <>
            <Input
                id="ce-title"
                name="title"
                label={copy.fieldTitle}
                value={props.title}
                isDisabled={locked}
                onValueChange={props.onTitle}
            />
            <Textarea
                label={copy.fieldBrief}
                rows={3}
                value={props.brief}
                isDisabled={locked}
                onValueChange={props.onBrief}
            />
            <Select
                label={copy.fieldPillar}
                options={[{ id: "", label: copy.noPillar }, ...props.pillars.map((p) => ({ id: p.id, label: p.name }))]}
                value={props.pillarId ?? ""}
                isDisabled={locked}
                onValueChange={(v) => props.onPillar(v || null)}
            />
            <CheckboxGroup
                label={copy.fieldChannels}
                orientation="horizontal"
                options={props.channelOptions}
                value={props.channels}
                isDisabled={locked}
                onValueChange={props.onChannels}
            />
            <Input
                id="ce-date"
                name="date"
                label={copy.fieldDate}
                value={props.date}
                description={copy.addDateHint}
                isDisabled={props.isDateLocked}
                onValueChange={props.onDate}
            />
            <Input
                id="ce-time"
                name="time"
                label={copy.fieldTime}
                value={props.time}
                description={copy.addTimeHint}
                isDisabled={props.isDateLocked}
                onValueChange={props.onTime}
            />
            {props.isEditable ? renderContentEditorDetailsHintFields(copy, props) : null}
            {props.warnings.length > 0 ? renderContentEditorDetailsDraftWarning(copy, props) : null}
        </>
    )
}

/** Renders the ContentEditorDetails hint fields section. */
const renderContentEditorDetailsHintFields = (
    copy: ContentEditorDetailsProps["copy"],
    props: ContentEditorDetailsProps,
) => (
    <>
        <Input
            id="ce-hint"
            name="hint"
            label={copy.draftHint}
            value={props.hint}
            isDisabled={props.isPending}
            onValueChange={props.onHint}
        />
        <div>
            <Button
                intent="neutral"
                isPending={props.isDrafting}
                isDisabled={props.isPending || props.channels.length === 0}
                onPress={props.onDraft}
            >
                {props.hasDraftText ? copy.redraft : copy.draftWithAi}
            </Button>
        </div>
    </>
)

/** Renders the ContentEditorDetails draft warning section. */
const renderContentEditorDetailsDraftWarning = (
    copy: ContentEditorDetailsProps["copy"],
    props: ContentEditorDetailsProps,
) => (
    <Alert
        tone="cautionary"
        title={copy.draftWarnTitle}
        description={
            <Stack gap="identity">
                {props.warnings.map((warning) => (
                    <Text key={warning} size="sm">
                        {warning}
                    </Text>
                ))}
            </Stack>
        }
    />
)
