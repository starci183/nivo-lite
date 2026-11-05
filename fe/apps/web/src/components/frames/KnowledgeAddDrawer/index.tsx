import {
    Alert,
    Button,
    ChoiceChips,
    Cluster,
    Drawer,
    EmptyNotice,
    Meter,
    Section,
    Stack,
    Text,
} from "@starci/grammar/common"
import { AddFilesPanel, knowledgeUploadRowsOf } from "@/components/composites/AddFilesPanel"
import { AddNotePanel } from "@/components/composites/AddNotePanel"
import { AddOptionsPanel } from "@/components/composites/AddOptionsPanel"
import { DrawerFooter } from "@/components/composites/DrawerFooter"
import { FormNotice } from "@/components/composites/FormNotice"
import { Icon } from "@/components/leaves/Icon"
import type { KnowledgeAddDrawerView } from "@/modules/types"

type Props = KnowledgeAddDrawerView

/** What the drawer draws. */
type KnowledgeAddDrawerProps = KnowledgeAddDrawerView

/** The way in from Google Drive: where the grant stands on the left, the button that picks from it on the right. */
const DriveRow = (props: Props) => {
    const drive = props.props.drive
    return (
        <Stack gap="inline">
            <Cluster gap="row" align="center" justify="between">
                {drive.note === undefined ? null : <Text size="sm">{drive.note}</Text>}
                {drive.label === undefined ? null : (
                    <Button
                        intent="neutral"
                        size="sm"
                        startContent={<Icon props={{ name: "attach", usage: "leading" }} />}
                        isDisabled={props.props.isBusy}
                        onPress={props.on.connectDrive}
                    >
                        {drive.label}
                    </Button>
                )}
            </Cluster>
            {drive.trouble === undefined ? null : <Alert tone="negative" title={drive.trouble} />}
        </Stack>
    )
}

/** The files and links panel with the Drive row under its drop zone, then what is waiting to be added. */
const FilesPart = (props: Props) => (
    <>
        <AddFilesPanel
            {...props.props.files}
            afterDrop={<DriveRow {...props} />}
            isBusy={props.props.isBusy}
            onFiles={props.on.addFiles}
            onLink={props.on.setLink}
            onCheckLink={props.on.checkLink}
            onAddLink={props.on.addLink}
            onRemoveLink={props.on.removeLink}
            onDismissStopped={props.on.dismissStopped}
        />
        {props.props.files.queue.length === 0 ? null : (
            <Section
                kind="list"
                title={props.props.files.queueTitle}
                headingLevel={3}
                items={[
                    ...knowledgeUploadRowsOf({
                        queue: props.props.files.queue,
                        removeLabel: props.props.files.removeLabel,
                        onRetryItem: props.on.retryItem,
                        onRemoveItem: props.on.removeItem,
                    }),
                ]}
                empty={<EmptyNotice message={props.props.emptyQueueLabel} />}
            />
        )}
    </>
)

/** The mode chips, the panel of the chosen mode, the options of the batch and the notes under them. */
const DrawerBody = (props: Props) => (
    <Stack gap="section">
        <FormNotice failTitle={props.props.failTitle} error={props.props.error} done={props.props.notice} />
        <ChoiceChips
            label={props.props.modeLabel}
            isLabelHidden
            options={props.props.modeOptions.map((one) => ({
                value: one.id,
                label: one.label,
                isDisabled: props.props.isBusy,
            }))}
            value={props.props.mode}
            onValueChange={props.on.setMode}
            empty={<EmptyNotice message={props.props.modeLabel} />}
        />
        {props.props.mode === "files" ? (
            <FilesPart {...props} />
        ) : (
            <AddNotePanel
                {...props.props.note}
                isBusy={props.props.isBusy}
                onTitle={props.on.setTitle}
                onContent={props.on.setContent}
                onPair={props.on.setPair}
                onAddPair={props.on.addPair}
                onRemovePair={props.on.removePair}
            />
        )}
        <AddOptionsPanel
            {...props.props.options}
            isBusy={props.props.isBusy}
            onTopic={props.on.setTopic}
            onTags={props.on.setTags}
            onModule={props.on.setModule}
        />
        <Text size="xs" tone="muted">
            {props.props.internalNote}
        </Text>
        {props.props.usage === undefined ? null : (
            <Meter
                label={props.props.usage.label}
                value={props.props.usage.value}
                minValue={0}
                maxValue={props.props.usage.max}
                valueLabel={props.props.usage.valueLabel}
                tone={props.props.usage.tone}
            />
        )}
        {props.props.summary === null ? null : (
            <Alert
                tone="informative"
                title={props.props.summary.title}
                action={{ label: props.props.summary.actionLabel, onAction: props.on.seeQuestions }}
            />
        )}
    </Stack>
)

/**
 * The drawer that adds documents, over the Second Brain page: files and links (with Google Drive), a written note or questions with
 * answers, chosen by chips; the options of the batch folded under them; cancel and submit in the footer. A member who may
 * only read gets the words in place of the form.
 */
export const KnowledgeAddDrawer = (props: KnowledgeAddDrawerProps) => (
    <Drawer
        isOpen={props.props.isOpen}
        onOpenChange={(isOpen) => {
            if (!isOpen) props.on.close()
        }}
        title={props.props.title}
        closeLabel={props.props.closeLabel}
        placement="right"
        footer={
            props.props.readOnlyNote === undefined ? (
                <DrawerFooter
                    cancelLabel={props.props.cancelLabel}
                    submitLabel={props.props.submitLabel}
                    isPending={props.props.isBusy}
                    onCancel={props.on.close}
                    onSubmit={props.on.submit}
                />
            ) : undefined
        }
    >
        {props.props.readOnlyNote === undefined ? (
            <DrawerBody {...props} />
        ) : (
            <Text size="sm" tone="muted">
                {props.props.readOnlyNote}
            </Text>
        )}
    </Drawer>
)
