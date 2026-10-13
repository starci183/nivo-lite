import { Badge, Button, FileDropzone, Input, ListItem, SurfaceListCard, Text } from "@starci/grammar/common"
import {
    ITEM_CLASS_NAME,
    ITEM_TEXT_CLASS_NAME,
    LINK_FIELD_CLASS_NAME,
    LINK_ROW_CLASS_NAME,
    PANEL_CLASS_NAME,
} from "./classNames"

/** One link input. */
export interface LinkRowView {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly error?: string
}

/** One file or link waiting to be added, already worded. */
export interface QueueRowView {
    readonly id: string
    readonly name: string
    readonly detail: string
    readonly statusLabel: string
    readonly statusTone: "neutral" | "warning" | "success" | "danger"
    readonly error?: string
    readonly canRemove: boolean
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
    readonly note?: string
    readonly isBusy: boolean
    readonly onFiles: (files: Array<File>) => void
    readonly onLink: (id: string, value: string) => void
    readonly onCheckLink: (id: string) => void
    readonly onAddLink: () => void
    readonly onRemoveLink: (id: string) => void
    readonly onRemoveItem: (id: string) => void
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
                        variant="secondary"
                        placeholder={props.linkPlaceholder}
                        value={link.value}
                        errorMessage={link.error}
                        isError={link.error !== undefined}
                        isDisabled={props.isBusy}
                        onValueChange={(value) => props.onLink(link.id, value)}
                        onBlur={() => props.onCheckLink(link.id)}
                    />
                </div>
                <Button variant="ghost" isDisabled={props.isBusy} onPress={() => props.onRemoveLink(link.id)}>
                    {props.linkRemoveLabel}
                </Button>
            </div>
        ))}
        <Button variant="outline" isDisabled={props.isBusy} onPress={props.onAddLink}>
            {props.addLinkLabel}
        </Button>
        {props.note === undefined ? null : (
            <Text size="sm" tone="muted" live="polite">
                {props.note}
            </Text>
        )}
        {props.queue.length === 0 ? null : (
            <SurfaceListCard ariaLabel={props.queueTitle} isLoading={false} empty={null}>
                {props.queue.map((item) => (
                    <ListItem key={item.id} className={ITEM_CLASS_NAME}>
                        <div className={ITEM_TEXT_CLASS_NAME}>
                            <Text weight="semibold" overflow="truncate">
                                {item.name}
                            </Text>
                            <Text size="xs" tone="muted" overflow="truncate">
                                {item.error ?? item.detail}
                            </Text>
                        </div>
                        <Badge tone={item.statusTone}>{item.statusLabel}</Badge>
                        {item.canRemove ? (
                            <Button variant="ghost" onPress={() => props.onRemoveItem(item.id)}>
                                {props.removeLabel}
                            </Button>
                        ) : null}
                    </ListItem>
                ))}
            </SurfaceListCard>
        )}
    </div>
)
