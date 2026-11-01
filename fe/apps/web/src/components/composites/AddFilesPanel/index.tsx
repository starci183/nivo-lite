import { Badge, Button, FileDropzone, Input, ListRow, Progress, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BatchBytesView, LinkRowView, QueueRowView, StoppedUploadsView } from "@/modules/types"
import { LINK_FIELD_CLASS_NAME, LINK_ROW_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** The words, values and state of the files and links panel. */
type AddFilesPanelProps = {
    readonly dropPrompt: string
    readonly dropHint: string
    readonly linksLabel: string
    readonly linksHint: string
    readonly linkPlaceholder: string
    readonly linkRemoveLabel: string
    readonly addLinkLabel: string
    readonly queueTitle: string
    readonly removeLabel: string
    readonly links: ReadonlyArray<LinkRowView>
    readonly queue: ReadonlyArray<QueueRowView>
    readonly note?: string | undefined
    readonly batch?: BatchBytesView | undefined
    readonly stopped?: StoppedUploadsView | undefined
    readonly isBusy: boolean
    readonly onFiles: (files: Array<File>) => void
    readonly onLink: (id: string, value: string) => void
    readonly onCheckLink: (id: string) => void
    readonly onAddLink: () => void
    readonly onRemoveLink: (id: string) => void
    readonly onRemoveItem: (id: string) => void
    readonly onRetryItem: (id: string) => void
    readonly onDismissStopped: () => void
}

/** The link fields and the commands that change their number. */
type LinkRowsProps = Pick<
    AddFilesPanelProps,
    "links" | "linkPlaceholder" | "linkRemoveLabel" | "isBusy" | "onLink" | "onCheckLink" | "onRemoveLink"
>

const LinkRows = (props: LinkRowsProps) => (
    <>
        {props.links.map((link) => (
            <div key={link.id} className={LINK_ROW_CLASS_NAME}>
                <div className={LINK_FIELD_CLASS_NAME}>
                    <Input
                        id={`knowledge-add-${link.id}`}
                        name={link.id}
                        label={link.label}
                        placeholder={props.linkPlaceholder}
                        value={link.value}
                        errorMessage={link.error}
                        isError={link.error !== undefined}
                        isDisabled={props.isBusy}
                        onValueChange={(value) => props.onLink(link.id, value)}
                        onBlur={() => props.onCheckLink(link.id)}
                    />
                </div>
                <Button
                    intent="destructive"
                    step="entry"
                    isDisabled={props.isBusy}
                    onPress={() => props.onRemoveLink(link.id)}
                >
                    {props.linkRemoveLabel}
                </Button>
            </div>
        ))}
    </>
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

/** The queue of files and links waiting to be added. */
type QueueCardProps = Pick<AddFilesPanelProps, "queue" | "queueTitle" | "removeLabel" | "onRetryItem" | "onRemoveItem">

const QueueCard = (props: QueueCardProps) => (
    <>
        {props.queue.length === 0 ? null : (
            <SurfaceListCard ariaLabel={props.queueTitle} empty={null}>
                {props.queue.map((item) => (
                    <ListRow
                        key={item.id}
                        title={item.name}
                        description={item.error ?? item.detail}
                        badges={<Badge tone={item.statusTone}>{item.statusLabel}</Badge>}
                        actions={
                            <>
                                {item.retryLabel === undefined ? null : (
                                    <Button intent="alternative" onPress={() => props.onRetryItem(item.id)}>
                                        {item.retryLabel}
                                    </Button>
                                )}
                                {item.canRemove ? (
                                    <Button
                                        intent="destructive"
                                        step="entry"
                                        onPress={() => props.onRemoveItem(item.id)}
                                    >
                                        {props.removeLabel}
                                    </Button>
                                ) : null}
                            </>
                        }
                    />
                ))}
            </SurfaceListCard>
        )}
    </>
)

/** The files, the links and what is waiting to be added. */
export const AddFilesPanel = (props: AddFilesPanelProps) => (
    <div className={PANEL_CLASS_NAME}>
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
        <Text weight="semibold">{props.linksLabel}</Text>
        <Text size="sm" tone="muted">
            {props.linksHint}
        </Text>
        <LinkRows
            links={props.links}
            linkPlaceholder={props.linkPlaceholder}
            linkRemoveLabel={props.linkRemoveLabel}
            isBusy={props.isBusy}
            onLink={props.onLink}
            onCheckLink={props.onCheckLink}
            onRemoveLink={props.onRemoveLink}
        />
        <Button intent="neutral" isDisabled={props.isBusy} onPress={props.onAddLink}>
            {props.addLinkLabel}
        </Button>
        {props.note === undefined ? null : (
            <Text size="sm" tone="muted" live="polite">
                {props.note}
            </Text>
        )}
        <StoppedNotice stopped={props.stopped} isBusy={props.isBusy} onDismissStopped={props.onDismissStopped} />
        {props.batch === undefined ? null : (
            <Progress label={props.batch.label} value={props.batch.value} valueText={props.batch.valueText} />
        )}
        <QueueCard
            queue={props.queue}
            queueTitle={props.queueTitle}
            removeLabel={props.removeLabel}
            onRetryItem={props.onRetryItem}
            onRemoveItem={props.onRemoveItem}
        />
    </div>
)
