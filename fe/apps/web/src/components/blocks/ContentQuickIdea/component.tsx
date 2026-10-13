import { Alert, Button, CheckboxGroup, Dialog, Text, Textarea } from "@starci/grammar/common"
import type { ContentChannel, ContentNote, ContentT } from "@/hooks/content"
import { FORM_CLASS_NAME } from "./classNames"

/** What the quick idea command draws. */
export interface ContentQuickIdeaBaseProps {
    readonly props: {
        readonly t: ContentT
        readonly isOpen: boolean
        readonly topic: string
        readonly channels: ReadonlyArray<ContentChannel>
        readonly channelOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly isPending: boolean
        readonly note: ContentNote | null
    }
    readonly on: {
        readonly open: () => void
        readonly close: () => void
        readonly topic: (topic: string) => void
        readonly channels: (values: ReadonlyArray<string>) => void
        readonly run: () => void
        readonly dismissNote: () => void
    }
}

/** Draws the "quick idea" command and its dialog: paste a topic, choose channels, get drafts. */
export const ContentQuickIdeaBase = (props: ContentQuickIdeaBaseProps) => {
    const { t, isPending } = props.props
    return (
        <>
            <Button variant="secondary" onPress={props.on.open}>
                {t("quickIdea")}
            </Button>
            <Dialog
                isOpen={props.props.isOpen}
                onOpenChange={(open) => {
                    if (!open && !isPending) props.on.close()
                }}
                size="md"
                title={t("quickTitle")}
                description={t("quickBody")}
                closeLabel={t("close")}
                isDismissable={!isPending}
                footer={
                    <>
                        <Button variant="outline" isDisabled={isPending} onPress={props.on.close}>
                            {t("cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            isPending={isPending}
                            isDisabled={props.props.topic.trim().length < 3 || props.props.channels.length === 0}
                            onPress={props.on.run}
                        >
                            {t("quickRun")}
                        </Button>
                    </>
                }
            >
                <div className={FORM_CLASS_NAME}>
                    <Textarea
                        variant="secondary"
                        label={t("quickTopic")}
                        rows={4}
                        value={props.props.topic}
                        description={t("quickTopicHint")}
                        isDisabled={isPending}
                        onValueChange={props.on.topic}
                    />
                    <CheckboxGroup
                        label={t("quickChannels")}
                        orientation="horizontal"
                        variant="secondary"
                        options={props.props.channelOptions}
                        value={props.props.channels}
                        isDisabled={isPending}
                        onValueChange={props.on.channels}
                    />
                    {isPending ? (
                        <Text size="sm" live="polite">
                            {t("quickRunning")}
                        </Text>
                    ) : null}
                    {props.props.note ? (
                        <Alert
                            title={props.props.note.text}
                            tone={props.props.note.tone === "ok" ? "affirmative" : "negative"}
                            dismissLabel={t("close")}
                            onDismiss={props.on.dismissNote}
                        />
                    ) : null}
                </div>
            </Dialog>
        </>
    )
}
