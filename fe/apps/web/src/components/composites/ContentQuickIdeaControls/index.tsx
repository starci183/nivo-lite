import type { ContentViews, ContentActions } from "@/modules/types"

type ContentQuickIdeaControlsProps = ContentViews["quickIdeaFields"] & {
    readonly on: ContentActions["quickIdeaActions"]
    readonly isLoading: boolean
}
import { Text, Button, CheckboxGroup, Dialog, Stack, Textarea } from "@starci/grammar/common"
import { ContentCommandNote } from "@/components/leaves/ContentCommandNote"

/** Draws the "quick idea" command and its dialog: paste a topic, choose channels, get drafts. */
export const ContentQuickIdeaControls = (props: ContentQuickIdeaControlsProps) => {
    const { copy, isPending } = props
    return (
        <>
            <Button isLoading={props.isLoading} intent="neutral" onPress={props.on.open}>
                {copy.quickIdea}
            </Button>
            <Dialog
                isOpen={props.isOpen}
                onOpenChange={props.on.openChange}
                size="md"
                title={copy.quickTitle}
                description={copy.quickBody}
                closeLabel={copy.close}
                isDismissable={!isPending}
                footer={
                    <>
                        <Button
                            isLoading={props.isLoading}
                            intent="neutral"
                            isDisabled={isPending}
                            onPress={props.on.close}
                        >
                            {copy.cancel}
                        </Button>
                        <Button
                            isLoading={props.isLoading}
                            intent="commit"
                            isPending={isPending}
                            isDisabled={props.topic.trim().length < 3 || props.channels.length === 0}
                            onPress={props.on.run}
                        >
                            {copy.quickRun}
                        </Button>
                    </>
                }
            >
                <Stack gap="row">
                    <Textarea
                        isLoading={props.isLoading}
                        label={copy.quickTopic}
                        rows={4}
                        value={props.topic}
                        description={copy.quickTopicHint}
                        isDisabled={isPending}
                        onValueChange={props.on.topic}
                    />
                    <CheckboxGroup
                        isLoading={props.isLoading}
                        label={copy.quickChannels}
                        orientation="horizontal"
                        options={props.channelOptions}
                        value={props.channels}
                        isDisabled={isPending}
                        onValueChange={props.on.channels}
                    />
                    {isPending ? (
                        <Text size="sm" live="polite">
                            {copy.quickRunning}
                        </Text>
                    ) : null}
                    <ContentCommandNote note={props.note} closeLabel={copy.close} onDismiss={props.on.dismissNote} />
                </Stack>
            </Dialog>
        </>
    )
}
