import { ContentEditorAssets } from "@/components/composites/ContentEditorAssets"
import { Alert, AlertDialog, Button, Cluster, Dialog, Stack, Text } from "@starci/grammar/common"
import { ContentEditorDetails } from "@/components/leaves/ContentEditorDetails"
import { ContentEditorHistory } from "@/components/leaves/ContentEditorHistory"
import { ContentStatusBadge } from "@/components/leaves/ContentStatusBadge"
import type { ContentTransitionView, ContentViews, ContentActions } from "@/modules/types"
type ContentPostEditorViewProps = ContentViews["editorFields"] & {
    readonly on: ContentActions["editorActions"]
}

/** Draws the post editor: details, the text of each channel, media, links, the "post it" step once approved, the history and the commands. */
export const ContentPostEditorView = (props: ContentPostEditorViewProps) => {
    const { copy, item, canManage, busy } = props
    const on = props.on

    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="lg"
            title={item.title}
            closeLabel={copy.close}
            description={
                <Cluster gap="inline">
                    <ContentStatusBadge tone={props.tone} label={props.statusLabel} />
                    {props.scheduledText ? (
                        <Text as="span" size="sm" tone="muted">
                            {props.scheduledText}
                        </Text>
                    ) : null}
                    {item.approved_by ? (
                        <Text as="span" size="sm" tone="muted">
                            {props.approvedByLabel}
                        </Text>
                    ) : null}
                </Cluster>
            }
            footer={canManage ? renderEditorFooter(props) : undefined}
        >
            {renderEditorBody(props)}
            <AlertDialog
                isOpen={props.isDeleteOpen}
                onOpenChange={on.deleteOpen}
                title={copy.removeConfirm}
                tone="negative"
                confirmLabel={copy.remove}
                cancelLabel={copy.cancel}
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
const renderEditorFooter = (props: ContentPostEditorViewProps) => {
    const { copy, item, isEditable, isPending, busy } = props
    const on = props.on
    const status = item.status
    const transitionButton = (kind: ContentTransitionView, label: string) => (
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
        <Cluster gap="inline" justify="end">
            {["idea", "draft", "skipped"].includes(status) ? (
                <Button intent="destructive" step="entry" isDisabled={isPending} onPress={() => on.deleteOpen(true)}>
                    {copy.remove}
                </Button>
            ) : null}
            {["idea", "draft", "approved"].includes(status) ? transitionButton("skip", copy.skip) : null}
            {status === "approved" ? transitionButton("reopen", copy.reopen) : null}
            {status === "skipped" ? transitionButton("restore", copy.restore) : null}
            {isEditable ? (
                <Button intent="neutral" isPending={busy === "save"} isDisabled={isPending} onPress={on.save}>
                    {copy.save}
                </Button>
            ) : null}
            {status === "draft" ? (
                <Button
                    intent="commit"
                    isPending={busy === "submit"}
                    isDisabled={isPending || props.missingText}
                    onPress={on.submit}
                >
                    {copy.submit}
                </Button>
            ) : null}
        </Cluster>
    )
}

/** Draws the ContentEditorDetails section of the ContentPostEditor view. */
const renderEditorDetails = (props: ContentPostEditorViewProps) => {
    const { copy, item, form, isEditable, canManage, isPending, busy } = props
    const on = props.on
    const status = item.status

    return (
        <ContentEditorDetails
            title={form.title}
            brief={form.brief}
            pillarId={form.pillarId}
            channels={form.channels}
            channelOptions={props.channelOptions}
            date={form.date}
            time={form.time}
            pillars={props.pillars}
            hint={props.hint}
            warnings={props.warnings}
            isEditable={isEditable}
            isDateLocked={status === "published" || !canManage || isPending}
            isPending={isPending}
            isDrafting={busy === "draft"}
            hasDraftText={props.hasDraftText}
            copy={copy}
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
const renderEditorBody = (props: ContentPostEditorViewProps) => {
    const { copy, item } = props
    const on = props.on
    const status = item.status
    return (
        <Stack gap="row">
            {props.note ? (
                <Alert
                    title={props.note.text}
                    tone={props.note.tone === "ok" ? "affirmative" : "negative"}
                    dismissLabel={copy.close}
                    onDismiss={on.dismissNote}
                />
            ) : null}
            {status === "waiting_approval" || status === "approved" ? (
                <Text size="sm" tone="muted">
                    {copy.frozenNote}
                </Text>
            ) : null}
            {item.holiday_key ? (
                <Text size="sm" tone="muted">
                    {copy.holidayTag}: {item.holiday_key}
                </Text>
            ) : null}
            {status === "draft" && props.missingText ? (
                <Text size="xs" tone="muted">
                    {copy.submitNeedText}
                </Text>
            ) : null}
            {renderEditorDetails(props)}
            <ContentEditorAssets
                {...props.assets}
                copy={copy}
                item={item}
                isEditable={props.isEditable}
                canManage={props.canManage}
                isPending={props.isPending}
                busy={props.busy}
                on={on}
            />
            <ContentEditorHistory rows={props.history} copy={copy} />
            {status === "approved" ? (
                <Text size="xs" tone="muted">
                    {copy.reopenNote}
                </Text>
            ) : null}
        </Stack>
    )
}

/** Draws the channel variants, attached media, links and publishing proof. */
