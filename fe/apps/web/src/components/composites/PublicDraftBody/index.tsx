import { Alert, Form, Input, Stack, Text, Textarea } from "@starci/grammar/common"
import type { PublicBrainCopy, PublicDraftView, PublicFormView } from "@/modules/types"

/** What the body of the open public document draws and calls. */
interface PublicDraftBodyProps {
    readonly draft: PublicDraftView
    readonly form: PublicFormView
    readonly copy: PublicBrainCopy
    readonly isLoading: boolean
    readonly onTitle: (value: string) => void
    readonly onBody: (value: string) => void
    readonly onSubmit: () => void
}

/**
 * The body of the open public document: why it waits, then the two fields the owner edits (the name, the draft customers will read),
 * where it came from, what NIVO left out, who approved it and the text customers read now. Inert while NIVO is still drafting.
 */
export const PublicDraftBody = (props: PublicDraftBodyProps) => {
    const { draft, form, copy } = props
    const isDisabled = form.isBusy || props.isLoading || !draft.canEdit
    const description = draft.note?.description ?? null
    const noteDescription = description === null ? {} : { description }
    return (
        <Form label={copy.titleLabel} onSubmit={props.onSubmit} isPending={form.isBusy}>
            <Stack gap="section">
                {draft.note === null ? null : (
                    <Alert tone={draft.note.tone} title={draft.note.title} {...noteDescription} />
                )}
                <Input
                    id="public-doc-title"
                    name="title"
                    label={copy.titleLabel}
                    value={form.title}
                    isDisabled={isDisabled}
                    isLoading={props.isLoading}
                    onValueChange={props.onTitle}
                />
                <Textarea
                    id="public-doc-body"
                    name="body"
                    label={copy.bodyLabel}
                    rows={8}
                    value={form.body}
                    isDisabled={isDisabled}
                    isLoading={props.isLoading}
                    onValueChange={props.onBody}
                />
                {draft.sources.length === 0 ? null : (
                    <Stack gap="row">
                        <Text isStrong isLoading={props.isLoading}>
                            {copy.sourcesLabel}
                        </Text>
                        {draft.sources.map((source) => (
                            <Text key={source.id} size="sm" tone="muted" isLoading={props.isLoading}>
                                {source.label}
                            </Text>
                        ))}
                    </Stack>
                )}
                {draft.leftOut === null ? null : (
                    <Text size="sm" tone="muted" isLoading={props.isLoading}>
                        {draft.leftOut}
                    </Text>
                )}
                {draft.approval === null ? null : (
                    <Text size="sm" tone="muted" isLoading={props.isLoading}>
                        {draft.approval}
                    </Text>
                )}
                {draft.publishedBody === null ? null : (
                    <Textarea label={copy.publishedLabel} value={draft.publishedBody} isReadOnly rows={6} />
                )}
                {form.error === undefined ? null : (
                    <Alert tone="negative" title={copy.errorTitle} description={form.error} />
                )}
            </Stack>
        </Form>
    )
}
