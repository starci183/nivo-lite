import { Badge, Button, FileDropzone, Input, ListRow, Progress, SurfaceListCard, Text } from "@starci/grammar/common"
import { LINK_FIELD_CLASS_NAME, LINK_ROW_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** One link input. */
export interface LinkRowView {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly error?: string | undefined
}

/** One file or link waiting to be added, already worded. */
export interface QueueRowView {
    readonly id: string
    readonly name: string
    readonly detail: string
    readonly statusLabel: string
    readonly statusTone: "neutral" | "warning" | "success" | "danger"
    readonly error?: string | undefined
    readonly canRemove: boolean
    /** The words of the button that sends only this failed file again; absent when it cannot be retried. */
    readonly retryLabel?: string | undefined
}

/** The bytes of the batch on their way to storage. */
export interface BatchBytesView {
    readonly label: string
    /** 0 to 100, by bytes. */
    readonly value: number
    readonly valueText: string
}

/** The notice that uploads stopped when the page reloaded. */
export interface StoppedUploadsView {
    readonly text: string
    readonly dismissLabel: string
    /** Reopens the file picker: a browser cannot resume a file after a reload. */
    readonly pickLabel: string
}

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

/** The files, the links and what is waiting to be added. */
export const AddFilesPanel = (props: AddFilesPanelProps) => (
    <div className={PANEL_CLASS_NAME}>
        <FileDropzone
            id="knowledge-add-files"
            name="files"
            label={props.dropPrompt}
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
        <Button intent="neutral" isDisabled={props.isBusy} onPress={props.onAddLink}>
            {props.addLinkLabel}
        </Button>
        {props.note === undefined ? null : (
            <Text size="sm" tone="muted" live="polite">
                {props.note}
            </Text>
        )}
        {props.stopped === undefined ? null : (
            <>
                <Text size="sm" tone="muted" live="polite">
                    {props.stopped.text}
                </Text>
                <Button intent="commit" isDisabled={props.isBusy} onPress={() => document.getElementById("knowledge-add-files")?.click()}>
                    {props.stopped.pickLabel}
                </Button>
                <Button intent="neutral" onPress={props.onDismissStopped}>
                    {props.stopped.dismissLabel}
                </Button>
            </>
        )}
        {props.batch === undefined ? null : (
            <Progress label={props.batch.label} value={props.batch.value} valueText={props.batch.valueText} />
        )}
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
    </div>
)
