import type { ReactNode } from "react"
import { Button, Cluster, FileDropzone, Input, Progress, Stack, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { Icon } from "@/components/leaves/Icon"
import type { BatchBytesView, LinkRowView, QueueRowView, StoppedUploadsView } from "@/modules/types"

/** The words, values and state of the files and links panel. */
type AddFilesPanelProps = {
    readonly dropPrompt: string
    readonly dropHint: string
    readonly linksHint: string
    readonly linkPlaceholder: string
    readonly linkRemoveLabel: string
    readonly addLinkLabel: string
    readonly links: ReadonlyArray<LinkRowView>
    readonly note?: string | undefined
    /** What sits between the drop zone and the links (the way in from Google Drive). */
    readonly afterDrop?: ReactNode
    readonly batch?: BatchBytesView | undefined
    readonly stopped?: StoppedUploadsView | undefined
    readonly isBusy: boolean
    readonly onFiles: (files: Array<File>) => void
    readonly onLink: (id: string, value: string) => void
    readonly onCheckLink: (id: string) => void
    readonly onAddLink: () => void
    readonly onRemoveLink: (id: string) => void
    readonly onDismissStopped: () => void
}

/** The link fields and the commands that change their number. */
type LinkRowsProps = Pick<
    AddFilesPanelProps,
    "links" | "linkPlaceholder" | "linkRemoveLabel" | "isBusy" | "onLink" | "onCheckLink" | "onRemoveLink"
>

const LinkRows = (props: LinkRowsProps) => (
    <Stack gap="inline">
        {props.links.map((link) => (
            <Cluster key={link.id} gap="inline" align="end">
                <Input
                    id={`knowledge-add-${link.id}`}
                    name={link.id}
                    label={link.label}
                    placeholder={props.linkPlaceholder}
                    value={link.value}
                    errorMessage={link.error}
                    isInvalid={link.error !== undefined}
                    isDisabled={props.isBusy}
                    onValueChange={(value) => props.onLink(link.id, value)}
                    onBlur={() => props.onCheckLink(link.id)}
                />
                <Button
                    intent="destructive"
                    step="entry"
                    isDisabled={props.isBusy}
                    onPress={() => props.onRemoveLink(link.id)}
                >
                    {props.linkRemoveLabel}
                </Button>
            </Cluster>
        ))}
    </Stack>
)

/** The notice that an earlier page's uploads stopped, with the ways to go on. */
type StoppedNoticeProps = Pick<AddFilesPanelProps, "stopped" | "isBusy" | "onDismissStopped">

const StoppedNotice = (props: StoppedNoticeProps) => (
    <>
        {props.stopped === undefined ? null : (
            <>
                <Text size="sm" tone="muted" live="polite">
                    {props.stopped.text}
                </Text>
                <Button
                    intent="commit"
                    isDisabled={props.isBusy}
                    onPress={() => document.getElementById("knowledge-add-files")?.click()}
                >
                    {props.stopped.pickLabel}
                </Button>
                <Button intent="neutral" onPress={props.onDismissStopped}>
                    {props.stopped.dismissLabel}
                </Button>
            </>
        )}
    </>
)

/** The file queue's item data and actions, consumed by the containing card's final collection band. */
interface KnowledgeUploadRowsProps {
    readonly queue: ReadonlyArray<QueueRowView>
    readonly removeLabel: string
    readonly onRetryItem: (id: string) => void
    readonly onRemoveItem: (id: string) => void
}

/** Preserves each file's status, retry and cancel controls without drawing a second raised surface. */
export const knowledgeUploadRowsOf = (props: KnowledgeUploadRowsProps): ReadonlyArray<ListRowData> =>
    props.queue.map((item) => ({
        id: item.id,
        title: item.name,
        description: item.error ?? item.detail,
        badges: [{ label: item.statusLabel, tone: item.statusTone }],
        detail:
            item.retryLabel === undefined && !item.canRemove ? undefined : (
                <Cluster gap="inline">
                    {item.retryLabel === undefined ? null : (
                        <Button intent="alternative" onPress={() => props.onRetryItem(item.id)}>
                            {item.retryLabel}
                        </Button>
                    )}
                    {item.canRemove ? (
                        <Button intent="destructive" step="entry" onPress={() => props.onRemoveItem(item.id)}>
                            {props.removeLabel}
                        </Button>
                    ) : null}
                </Cluster>
            ),
    }))

/** The files, the links and what is waiting to be added. */
export const AddFilesPanel = (props: AddFilesPanelProps) => (
    <Stack gap="row">
        <FileDropzone
            id="knowledge-add-files"
            name="files"
            label={props.dropPrompt}
            isLabelHidden
            description={props.dropHint}
            prompt={props.dropPrompt}
            multiple
            hideFileList
            isDisabled={props.isBusy}
            onFilesChange={props.onFiles}
        />
        {props.afterDrop}
        <LinkRows
            links={props.links}
            linkPlaceholder={props.linkPlaceholder}
            linkRemoveLabel={props.linkRemoveLabel}
            isBusy={props.isBusy}
            onLink={props.onLink}
            onCheckLink={props.onCheckLink}
            onRemoveLink={props.onRemoveLink}
        />
        <Text size="sm" tone="muted">
            {props.linksHint}
        </Text>
        <div>
            <Button
                intent="neutral"
                size="sm"
                startContent={<Icon props={{ name: "add", usage: "leading" }} />}
                isDisabled={props.isBusy}
                onPress={props.onAddLink}
            >
                {props.addLinkLabel}
            </Button>
        </div>
        {props.note === undefined ? null : (
            <Text size="sm" tone="muted" live="polite">
                {props.note}
            </Text>
        )}
        <StoppedNotice stopped={props.stopped} isBusy={props.isBusy} onDismissStopped={props.onDismissStopped} />
        {props.batch === undefined ? null : (
            <Progress label={props.batch.label} value={props.batch.value} valueText={props.batch.valueText} />
        )}
    </Stack>
)
