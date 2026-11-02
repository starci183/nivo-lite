import type { ContentViews, ContentActions } from "@/modules/types"

type ContentAddPostControlsProps = ContentViews["addPostFields"] & {
    readonly on: ContentActions["addPostActions"]
    readonly isLoading: boolean
}
import { Button, CheckboxGroup, Dialog, Input, Select, Stack } from "@starci/grammar/common"
import { ContentCommandNote } from "@/components/leaves/ContentCommandNote"

/** Draws the "add a post" command and its dialog: a manual idea with an optional date. */
export const ContentAddPostControls = (props: ContentAddPostControlsProps) => {
    const { copy, isPending } = props
    return (
        <>
            <Button isLoading={props.isLoading} intent="neutral" onPress={props.on.open}>
                {copy.addPost}
            </Button>
            <Dialog
                isOpen={props.isOpen}
                onOpenChange={props.on.openChange}
                size="md"
                title={copy.addTitle}
                closeLabel={copy.close}
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
                            isDisabled={props.title.trim() === "" || props.channels.length === 0}
                            onPress={props.on.run}
                        >
                            {copy.addRun}
                        </Button>
                    </>
                }
            >
                {renderNewPostFields(props.copy, props, isPending)}
            </Dialog>
        </>
    )
}

/** Draws the div section of the ContentAddPost view. */
const renderNewPostFields = (
    copy: ContentAddPostControlsProps["copy"],
    props: ContentAddPostControlsProps,
    isPending: ContentAddPostControlsProps["isPending"],
) => {
    return (
        <Stack gap="row">
            <Input
                isLoading={props.isLoading}
                id="add-title"
                name="title"
                label={copy.addFieldTitle}
                value={props.title}
                isDisabled={isPending}
                onValueChange={props.on.title}
            />
            <Input
                isLoading={props.isLoading}
                id="add-date"
                name="date"
                label={copy.addDate}
                value={props.date}
                description={copy.addDateHint}
                isDisabled={isPending}
                onValueChange={props.on.date}
            />
            <Input
                isLoading={props.isLoading}
                id="add-time"
                name="time"
                label={copy.addTime}
                value={props.time}
                description={copy.addTimeHint}
                isDisabled={isPending}
                onValueChange={props.on.time}
            />
            {props.pillarOptions.length > 1 ? (
                <Select
                    isLoading={props.isLoading}
                    label={copy.fieldPillar}
                    options={props.pillarOptions}
                    value={props.pillarId ?? ""}
                    isDisabled={isPending}
                    onValueChange={(v) => props.on.pillar(v || null)}
                />
            ) : null}
            <CheckboxGroup
                isLoading={props.isLoading}
                label={copy.fieldChannels}
                orientation="horizontal"
                options={props.channelOptions}
                value={props.channels}
                isDisabled={isPending}
                onValueChange={props.on.channels}
            />
            <ContentCommandNote note={props.note} closeLabel={copy.close} onDismiss={props.on.dismissNote} />
        </Stack>
    )
}
