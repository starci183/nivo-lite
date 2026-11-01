import { Button, CheckboxGroup, Dialog, Input, Select, Stack } from "@starci/grammar/common"
import { ContentCommandNote } from "@/components/composites/ContentSettingsCard"
import type { ContentChannel, ContentNoteView, ContentT } from "@/modules/types"

/** What the add-a-post command draws. */
export interface ContentAddPostBaseProps {
    readonly props: {
        readonly t: ContentT
        readonly isOpen: boolean
        readonly title: string
        readonly date: string
        readonly time: string
        readonly pillarId: string | null
        readonly channels: ReadonlyArray<ContentChannel>
        readonly channelOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly pillarOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly isPending: boolean
        readonly note: ContentNoteView | null
    }
    readonly on: {
        readonly open: () => void
        readonly close: () => void
        readonly openChange: (open: boolean) => void
        readonly title: (v: string) => void
        readonly date: (v: string) => void
        readonly time: (v: string) => void
        readonly pillar: (id: string | null) => void
        readonly channels: (values: ReadonlyArray<string>) => void
        readonly run: () => void
        readonly dismissNote: () => void
    }
}

/** Draws the "add a post" command and its dialog: a manual idea with an optional date. */
export const ContentAddPostBase = (props: ContentAddPostBaseProps) => {
    const { t, isPending } = props.props
    return (
        <>
            <Button intent="neutral" onPress={props.on.open}>
                {t("addPost")}
            </Button>
            <Dialog
                isOpen={props.props.isOpen}
                onOpenChange={props.on.openChange}
                size="md"
                title={t("addTitle")}
                closeLabel={t("close")}
                footer={
                    <>
                        <Button intent="neutral" isDisabled={isPending} onPress={props.on.close}>
                            {t("cancel")}
                        </Button>
                        <Button
                            intent="commit"
                            isPending={isPending}
                            isDisabled={props.props.title.trim() === "" || props.props.channels.length === 0}
                            onPress={props.on.run}
                        >
                            {t("addRun")}
                        </Button>
                    </>
                }
            >
                {renderNewPostFields(t, props, isPending)}
            </Dialog>
        </>
    )
}

/** Draws the div section of the ContentAddPost view. */
const renderNewPostFields = (
    t: ContentAddPostBaseProps["props"]["t"],
    props: ContentAddPostBaseProps,
    isPending: ContentAddPostBaseProps["props"]["isPending"],
) => {
    return (
        <Stack gap="row">
            <Input
                id="add-title"
                name="title"
                label={t("addFieldTitle")}
                value={props.props.title}
                isDisabled={isPending}
                onValueChange={props.on.title}
            />
            <Input
                id="add-date"
                name="date"
                label={t("addDate")}
                value={props.props.date}
                description={t("addDateHint")}
                isDisabled={isPending}
                onValueChange={props.on.date}
            />
            <Input
                id="add-time"
                name="time"
                label={t("addTime")}
                value={props.props.time}
                description={t("addTimeHint")}
                isDisabled={isPending}
                onValueChange={props.on.time}
            />
            {props.props.pillarOptions.length > 1 ? (
                <Select
                    label={t("fieldPillar")}
                    options={props.props.pillarOptions}
                    value={props.props.pillarId ?? ""}
                    isDisabled={isPending}
                    onValueChange={(v) => props.on.pillar(v || null)}
                />
            ) : null}
            <CheckboxGroup
                label={t("fieldChannels")}
                orientation="horizontal"
                options={props.props.channelOptions}
                value={props.props.channels}
                isDisabled={isPending}
                onValueChange={props.on.channels}
            />
            <ContentCommandNote note={props.props.note} closeLabel={t("close")} onDismiss={props.on.dismissNote} />
        </Stack>
    )
}
