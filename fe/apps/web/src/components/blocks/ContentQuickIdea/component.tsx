import { Button, CheckboxGroup, Dialog, Textarea } from "@starci/grammar/common"
import {
    ContentCommandNote,
    getContentCommandProgressProps,
    renderContentCommandProgress,
} from "@/components/composites/ContentSettingsCard"
import { SlotView } from "@/components/composites/SlotView"
import type { ContentChannel, ContentNote } from "@/hooks/content"
import type { ContentT } from "@/modules/types"
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
        readonly openChange: (open: boolean) => void
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
            <Button intent="neutral" onPress={props.on.open}>
                {t("quickIdea")}
            </Button>
            <Dialog
                isOpen={props.props.isOpen}
                onOpenChange={props.on.openChange}
                size="md"
                title={t("quickTitle")}
                description={t("quickBody")}
                closeLabel={t("close")}
                isDismissable={!isPending}
                footer={
                    <>
                        <Button intent="neutral" isDisabled={isPending} onPress={props.on.close}>
                            {t("cancel")}
                        </Button>
                        <Button
                            intent="commit"
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
                        options={props.props.channelOptions}
                        value={props.props.channels}
                        isDisabled={isPending}
                        onValueChange={props.on.channels}
                    />
                    <SlotView {...getContentCommandProgressProps(isPending, t("quickRunning"))}>
                        {renderContentCommandProgress}
                    </SlotView>
                    <ContentCommandNote
                        note={props.props.note}
                        closeLabel={t("close")}
                        onDismiss={props.on.dismissNote}
                    />
                </div>
            </Dialog>
        </>
    )
}
