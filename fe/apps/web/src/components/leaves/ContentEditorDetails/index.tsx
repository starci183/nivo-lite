import { Alert, Button, CheckboxGroup, Input, List, ListItem, Select, Text, Textarea } from "@starci/grammar/common"
import type { ContentT, Pillar } from "@/hooks/content"

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
    readonly t: ContentT
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
    const { t } = props
    const locked = !props.isEditable || props.isPending
    return (
        <>
            <Input
                id="ce-title"
                name="title"
                label={t("fieldTitle")}
                value={props.title}
                isDisabled={locked}
                onValueChange={props.onTitle}
            />
            <Textarea
                label={t("fieldBrief")}
                rows={3}
                value={props.brief}
                isDisabled={locked}
                onValueChange={props.onBrief}
            />
            <Select
                label={t("fieldPillar")}
                options={[{ id: "", label: t("noPillar") }, ...props.pillars.map((p) => ({ id: p.id, label: p.name }))]}
                value={props.pillarId ?? ""}
                isDisabled={locked}
                onValueChange={(v) => props.onPillar(v || null)}
            />
            <CheckboxGroup
                label={t("fieldChannels")}
                orientation="horizontal"
                options={props.channelOptions}
                value={props.channels}
                isDisabled={locked}
                onValueChange={props.onChannels}
            />
            <Input
                id="ce-date"
                name="date"
                label={t("fieldDate")}
                value={props.date}
                hint={t("addDateHint")}
                isDisabled={props.isDateLocked}
                onValueChange={props.onDate}
            />
            <Input
                id="ce-time"
                name="time"
                label={t("fieldTime")}
                value={props.time}
                hint={t("addTimeHint")}
                isDisabled={props.isDateLocked}
                onValueChange={props.onTime}
            />
            {props.isEditable ? renderContentEditorDetailsHintFields(t, props) : null}
            {props.warnings.length > 0 ? renderContentEditorDetailsDraftWarning(t, props) : null}
        </>
    )
}

/** Renders the ContentEditorDetails hint fields section. */
const renderContentEditorDetailsHintFields = (
    t: NonNullable<ContentEditorDetailsProps["t"]>,
    props: ContentEditorDetailsProps,
) => (
    <>
        <Input
            id="ce-hint"
            name="hint"
            label={t("draftHint")}
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
                {props.hasDraftText ? t("redraft") : t("draftWithAi")}
            </Button>
        </div>
    </>
)

/** Renders the ContentEditorDetails draft warning section. */
const renderContentEditorDetailsDraftWarning = (
    t: NonNullable<ContentEditorDetailsProps["t"]>,
    props: ContentEditorDetailsProps,
) => (
    <Alert
        tone="cautionary"
        title={t("draftWarnTitle")}
        description={
            <List label={t("draftWarnTitle")}>
                {props.warnings.map((w) => (
                    <ListItem key={w}>
                        <Text as="span" size="sm">
                            {w}
                        </Text>
                    </ListItem>
                ))}
            </List>
        }
    />
)
