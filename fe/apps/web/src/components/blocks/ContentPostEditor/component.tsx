import { ContentEditorAssets } from "@/components/composites/ContentEditorAssets"
import { Alert, AlertDialog, Button, Dialog, Text, type BadgeTone } from "@starci/grammar/common"
import { ContentEditorDetails } from "@/components/leaves/ContentEditorDetails"
import { ContentEditorHistory } from "@/components/leaves/ContentEditorHistory"
import type { LinkRow } from "@/components/leaves/ContentEditorLinks"
import type { PublishProof } from "@/components/leaves/ContentEditorPublish"
import type { OpenVariant } from "@/components/leaves/ContentEditorVariants"
import { ContentStatusBadge } from "@/components/leaves/ContentStatusBadge"
import type { ContentItem, ContentNote, ItemTransition, EditorForm } from "@/hooks/content"
import type { ContentT, DownloadFile, HistoryRow, MediaTile, Pillar, PublishStep } from "@/modules/types"
import { DESCRIPTION_CLASS_NAME, FOOTER_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** What the post editor draws. */
export interface ContentPostEditorBaseProps {
    readonly props: {
        readonly t: ContentT
        readonly item: ContentItem
        readonly form: EditorForm
        readonly pillars: ReadonlyArray<Pillar>
        /** The words and tone of the status badge. */
        readonly statusLabel: string
        readonly tone: BadgeTone
        readonly channelOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        /** The channel tabs and the text of the one that is open. */
        readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly openVariant: OpenVariant | null
        readonly media: ReadonlyArray<MediaTile>
        /** Library files not attached yet. */
        readonly library: ReadonlyArray<MediaTile>
        readonly linkRows: ReadonlyArray<LinkRow>
        readonly steps: ReadonlyArray<PublishStep>
        readonly files: ReadonlyArray<DownloadFile>
        readonly history: ReadonlyArray<HistoryRow>
        readonly videos: ReadonlyArray<{ readonly id: string; readonly label: string }>
        /** The date and time of the post, already formatted, or an empty text. */
        readonly scheduledText: string
        readonly isEditable: boolean
        readonly canManage: boolean
        readonly isPending: boolean
        readonly busy: string | null
        readonly note: ContentNote | null
        readonly hint: string
        readonly isLibraryOpen: boolean
        readonly proof: Readonly<Record<string, PublishProof | undefined>>
        readonly warnings: ReadonlyArray<string>
        readonly isDeleteOpen: boolean
        readonly missingText: boolean
        readonly hasDraftText: boolean
    }
    readonly on: {
        readonly close: () => void
        readonly dismissNote: () => void
        readonly patch: (change: Partial<EditorForm>) => void
        readonly channels: (values: ReadonlyArray<string>) => void
        readonly tab: (id: string) => void
        readonly text: (text: string) => void
        readonly note: (note: string) => void
        readonly tags: (text: string) => void
        readonly hint: (hint: string) => void
        readonly toggleLibrary: () => void
        readonly attach: (key: string) => void
        readonly attachVideo: (id: string) => void
        readonly removeMedia: (key: string) => void
        readonly upload: (file: File) => void
        readonly link: (key: string, change: { readonly url?: string; readonly label?: string }) => void
        readonly addLink: () => void
        readonly removeLink: (key: string) => void
        readonly proof: (channel: string, change: Partial<PublishProof>) => void
        readonly copy: (channel: string) => void
        readonly mark: (channel: string) => void
        readonly save: () => void
        readonly draft: () => void
        readonly submit: () => void
        readonly transition: (kind: ItemTransition) => void
        readonly deleteOpen: (open: boolean) => void
    }
}

/** Draws the post editor: details, the text of each channel, media, links, the "post it" step once approved, the history and the commands. */
export const ContentPostEditorBase = (props: ContentPostEditorBaseProps) => {
    const { t, item, canManage, busy } = props.props
    const on = props.on

    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="lg"
            title={item.title}
            closeLabel={t("close")}
            description={
                <div className={DESCRIPTION_CLASS_NAME}>
                    <ContentStatusBadge tone={props.props.tone} label={props.props.statusLabel} />
                    {props.props.scheduledText ? (
                        <Text as="span" size="sm" tone="muted">
                            {props.props.scheduledText}
                        </Text>
                    ) : null}
                    {item.approved_by ? (
                        <Text as="span" size="sm" tone="muted">
                            {t("approvedBy", { who: item.approved_by })}
                        </Text>
                    ) : null}
                </div>
            }
            footer={canManage ? renderEditorFooter(props) : undefined}
        >
            {renderEditorBody(props)}
            <AlertDialog
                isOpen={props.props.isDeleteOpen}
                onOpenChange={on.deleteOpen}
                title={t("removeConfirm")}
                tone="negative"
                confirmLabel={t("remove")}
                cancelLabel={t("cancel")}
                isConfirmPending={busy === "transition"}
                onConfirm={() => {
                    on.deleteOpen(false)
                    on.transition("delete")
                }}
                onCancel={() => on.deleteOpen(false)}
            />
        </Dialog>
    )
}

/** Draws the div section of the ContentPostEditor view. */
const renderEditorFooter = (props: ContentPostEditorBaseProps) => {
    const { t, item, isEditable, isPending, busy } = props.props
    const on = props.on
    const status = item.status
    const transitionButton = (kind: ItemTransition, label: string) => (
        <Button
            intent="neutral"
            isPending={busy === "transition"}
            isDisabled={isPending}
            onPress={() => on.transition(kind)}
        >
            {label}
        </Button>
    )

    return (
        <div className={FOOTER_CLASS_NAME}>
            {["idea", "draft", "skipped"].includes(status) ? (
                <Button intent="destructive" step="entry" isDisabled={isPending} onPress={() => on.deleteOpen(true)}>
                    {t("remove")}
                </Button>
            ) : null}
            {["idea", "draft", "approved"].includes(status) ? transitionButton("skip", t("skip")) : null}
            {status === "approved" ? transitionButton("reopen", t("reopen")) : null}
            {status === "skipped" ? transitionButton("restore", t("restore")) : null}
            {isEditable ? (
                <Button intent="neutral" isPending={busy === "save"} isDisabled={isPending} onPress={on.save}>
                    {t("save")}
                </Button>
            ) : null}
            {status === "draft" ? (
                <Button
                    intent="commit"
                    isPending={busy === "submit"}
                    isDisabled={isPending || props.props.missingText}
                    onPress={on.submit}
                >
                    {t("submit")}
                </Button>
            ) : null}
        </div>
    )
}

/** Draws the ContentEditorDetails section of the ContentPostEditor view. */
const renderEditorDetails = (props: ContentPostEditorBaseProps) => {
    const { t, item, form, isEditable, canManage, isPending, busy } = props.props
    const on = props.on
    const status = item.status

    return (
        <ContentEditorDetails
            title={form.title}
            brief={form.brief}
            pillarId={form.pillarId}
            channels={form.channels}
            channelOptions={props.props.channelOptions}
            date={form.date}
            time={form.time}
            pillars={props.props.pillars}
            hint={props.props.hint}
            warnings={props.props.warnings}
            isEditable={isEditable}
            isDateLocked={status === "published" || !canManage || isPending}
            isPending={isPending}
            isDrafting={busy === "draft"}
            hasDraftText={props.props.hasDraftText}
            t={t}
            onTitle={(title) => on.patch({ title })}
            onBrief={(brief) => on.patch({ brief })}
            onPillar={(pillarId) => on.patch({ pillarId })}
            onChannels={on.channels}
            onDate={(date) => on.patch({ date })}
            onTime={(time) => on.patch({ time })}
            onHint={on.hint}
            onDraft={on.draft}
        />
    )
}

/** Draws the editor notices, fields and publishing history. */
const renderEditorBody = (props: ContentPostEditorBaseProps) => {
    const { t, item } = props.props
    const on = props.on
    const status = item.status
    return (
        <div className={FORM_CLASS_NAME}>
            {props.props.note ? (
                <Alert
                    title={props.props.note.text}
                    tone={props.props.note.tone === "ok" ? "affirmative" : "negative"}
                    dismissLabel={t("close")}
                    onDismiss={on.dismissNote}
                />
            ) : null}
            {status === "waiting_approval" || status === "approved" ? (
                <Text size="sm" tone="muted">
                    {t("frozenNote")}
                </Text>
            ) : null}
            {item.holiday_key ? (
                <Text size="sm" tone="muted">
                    {t("holidayTag")}: {item.holiday_key}
                </Text>
            ) : null}
            {status === "draft" && props.props.missingText ? (
                <Text size="xs" tone="muted">
                    {t("submitNeedText")}
                </Text>
            ) : null}
            {renderEditorDetails(props)}
            <ContentEditorAssets {...props} />
            <ContentEditorHistory rows={props.props.history} t={t} />
            {status === "approved" ? (
                <Text size="xs" tone="muted">
                    {t("reopenNote")}
                </Text>
            ) : null}
        </div>
    )
}

/** Draws the channel variants, attached media, links and publishing proof. */
