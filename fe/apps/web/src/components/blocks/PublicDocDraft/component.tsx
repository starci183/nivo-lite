import { Alert, Badge, Button, Drawer, Form, Input, Text, Textarea } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { FOOTER_CLASS_NAME, FORM_CLASS_NAME, SOURCES_CLASS_NAME } from "./classNames"

/** One reviewed document with its resolved provenance, copy and editor fields. */
interface DraftView {
    readonly id: string
    readonly badge: { readonly label: string; readonly tone: "neutral" | "warning" | "success" | "danger" }
    readonly alert: { readonly tone: "informative" | "negative" | "cautionary"; readonly title: string } | undefined
    readonly titleLabel: string
    readonly bodyLabel: string
    readonly docTitle: string
    readonly body: string
    readonly canEdit: boolean
    readonly sourcesLabel: string
    readonly sources: ReadonlyArray<{
        readonly id: string
        readonly title: string
        readonly changedLabel: string | undefined
    }>
    readonly leftOut: string | undefined
    readonly approval: string | undefined
    readonly publishedLabel: string
    readonly publishedBody: string | null
    readonly saveLabel: string
    readonly redraftLabel: string | undefined
    readonly approveLabel: string | undefined
    readonly laterLabel: string
    readonly error: string | undefined
    readonly failTitle: string
}

/** The loading drawing reuses the editable document's geometry. */
const PLACEHOLDER: readonly DraftView[] = [
    {
        id: "document-placeholder",
        badge: { label: "-", tone: "neutral" },
        alert: undefined,
        titleLabel: "-",
        bodyLabel: "-",
        docTitle: "-",
        body: "-",
        canEdit: false,
        sourcesLabel: "-",
        sources: [{ id: "source-placeholder", title: "-", changedLabel: undefined }],
        leftOut: undefined,
        approval: undefined,
        publishedLabel: "-",
        publishedBody: null,
        saveLabel: "-",
        redraftLabel: undefined,
        approveLabel: undefined,
        laterLabel: "-",
        error: undefined,
        failTitle: "-",
    },
]

/** An independently retryable document read and its local commands. */
export interface PublicDocDraftBaseProps {
    readonly props: {
        readonly title: string
        readonly closeLabel: string
        readonly isPending: boolean
        readonly pendingAction: "save" | "approve" | "redraft" | undefined
        readonly document: DataSlot<readonly DraftView[]>
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly close: () => void
        readonly setTitle: (value: string) => void
        readonly setBody: (value: string) => void
        readonly save: () => void
        readonly redraft: () => void
        readonly approve: () => void
        readonly retry: () => void
    }
}

interface DocumentBodyProps {
    readonly document: DraftView
    readonly isPending: boolean
    readonly isLoading: boolean
    readonly pendingAction: PublicDocDraftBaseProps["props"]["pendingAction"]
    readonly on: PublicDocDraftBaseProps["on"]
}

/** Keeps all decisions beside the text being reviewed. */
const Footer = (props: Omit<DocumentBodyProps, "isLoading">) => (
    <div className={FOOTER_CLASS_NAME}>
        <Button intent="alternative" isDisabled={props.isPending} onPress={props.on.close}>
            {props.document.laterLabel}
        </Button>
        {props.document.canEdit ? (
            <Button
                intent="neutral"
                isPending={props.pendingAction === "save"}
                isDisabled={props.isPending && props.pendingAction !== "save"}
                onPress={props.on.save}
            >
                {props.document.saveLabel}
            </Button>
        ) : null}
        {props.document.redraftLabel === undefined ? null : (
            <Button
                intent="neutral"
                isPending={props.pendingAction === "redraft"}
                isDisabled={props.isPending && props.pendingAction !== "redraft"}
                onPress={props.on.redraft}
            >
                {props.document.redraftLabel}
            </Button>
        )}
        {props.document.approveLabel === undefined ? null : (
            <Button
                intent="commit"
                isPending={props.pendingAction === "approve"}
                isDisabled={props.isPending && props.pendingAction !== "approve"}
                onPress={props.on.approve}
            >
                {props.document.approveLabel}
            </Button>
        )}
    </div>
)

/** Draws the editable snapshot and the previously approved text in the same review journey. */
const DocumentBody = (props: Omit<DocumentBodyProps, "pendingAction">) => {
    const view = props.document
    const isDisabled = props.isPending || props.isLoading || !view.canEdit
    return (
        <Form label={view.titleLabel} onSubmit={props.on.save} isPending={props.isPending}>
            <div className={FORM_CLASS_NAME}>
                <Badge tone={view.badge.tone} isLoading={props.isLoading}>
                    {view.badge.label}
                </Badge>
                {view.alert === undefined ? null : <Alert tone={view.alert.tone} title={view.alert.title} />}
                <Input
                    id="public-doc-title"
                    name="title"
                    label={view.titleLabel}
                    value={view.docTitle}
                    isDisabled={isDisabled}
                    isLoading={props.isLoading}
                    onValueChange={props.on.setTitle}
                />
                <Textarea
                    id="public-doc-body"
                    name="body"
                    label={view.bodyLabel}
                    rows={10}
                    value={view.body}
                    isDisabled={isDisabled}
                    isLoading={props.isLoading}
                    onValueChange={props.on.setBody}
                />
                <div className={SOURCES_CLASS_NAME}>
                    <Text isStrong isLoading={props.isLoading}>
                        {view.sourcesLabel}
                    </Text>
                    {view.sources.map((source) => (
                        <Text key={source.id} size="sm" tone="muted" isLoading={props.isLoading}>
                            {source.changedLabel === undefined
                                ? source.title
                                : `${source.title} · ${source.changedLabel}`}
                        </Text>
                    ))}
                </div>
                {view.leftOut === undefined ? null : (
                    <Text size="sm" tone="muted">
                        {view.leftOut}
                    </Text>
                )}
                {view.approval === undefined ? null : (
                    <Text size="sm" tone="muted">
                        {view.approval}
                    </Text>
                )}
                {view.publishedBody === null ? null : (
                    <Textarea label={view.publishedLabel} value={view.publishedBody} isReadOnly rows={6} />
                )}
                {view.error === undefined ? null : (
                    <Alert tone="negative" title={view.failTitle} description={view.error} />
                )}
            </div>
        </Form>
    )
}

/** The review drawer retains the read's failure and draws the same form while its snapshot loads. */
export const PublicDocDraftBase = (props: PublicDocDraftBaseProps) => {
    const current = "items" in props.props.document ? props.props.document.items[0] : undefined
    return (
        <Drawer
            isOpen
            title={props.props.title}
            closeLabel={props.props.closeLabel}
            placement="right"
            onOpenChange={(open) => {
                if (!open && !props.props.isPending) props.on.close()
            }}
            footer={
                current === undefined ? undefined : (
                    <Footer
                        document={current}
                        isPending={props.props.isPending}
                        pendingAction={props.props.pendingAction}
                        on={props.on}
                    />
                )
            }
        >
            <SlotView
                slot={props.props.document}
                placeholder={PLACEHOLDER}
                labels={props.props.slotLabels}
                onRetry={props.on.retry}
                render={(documents, isLoading) =>
                    documents.map((document) => (
                        <DocumentBody
                            key={document.id}
                            document={document}
                            isPending={props.props.isPending}
                            isLoading={isLoading}
                            on={props.on}
                        />
                    ))
                }
            />
        </Drawer>
    )
}
