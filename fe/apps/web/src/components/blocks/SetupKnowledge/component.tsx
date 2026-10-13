import { Alert, Button, List, ListItem, Skeleton, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { COUNTS, NOTE, NOTES, ROW, STACK } from "./classNames"

/** One note from Office or the setup chat waiting for approval. */
export interface SetupKnowledgeNote {
    readonly id: string
    readonly body: string
    readonly meta: string
}

/** Copy and state of the knowledge cards of the setup. */
export interface SetupKnowledgeBaseProps {
    readonly props: {
        readonly isLoading: boolean
        readonly cardTitle: string
        readonly nivoLine: string
        readonly businessLine: string
        readonly publicLine: string
        readonly emptyHint: string
        readonly knowledgeHref: string
        readonly knowledgeLabel: string
        readonly nivoHref: string
        readonly nivoLabel: string
        readonly notesTitle: string
        readonly notesHint: string
        readonly notesEmpty: string
        readonly notes: ReadonlyArray<SetupKnowledgeNote>
        readonly dismissLabel: string
        readonly approveLabel: string
        readonly isPending: boolean
        readonly messageTone: "idle" | "applied" | "refused"
        readonly messageTitle: string
        readonly messageText: string
    }
    readonly on: { readonly approve: () => void; readonly dismiss: (id: string) => void }
}

/** Draws the knowledge this module runs on, and the notes from Office waiting for the owner to approve them. */
export const SetupKnowledgeBase = (props: SetupKnowledgeBaseProps) => {
    const { props: view } = props
    if (view.isLoading) {
        return (
            <>
                <SurfaceCard label={view.cardTitle} headingLevel={2}>
                    <Skeleton shape="text" lines={2} />
                </SurfaceCard>
                <SurfaceCard label={view.notesTitle} headingLevel={2}>
                    <Skeleton shape="text" lines={2} />
                </SurfaceCard>
            </>
        )
    }
    return (
        <>
            <SurfaceCard label={view.cardTitle} headingLevel={2}>
                <div className={STACK}>
                    <List label={view.cardTitle} className={COUNTS}>
                        <ListItem>
                            <Text size="sm">{view.nivoLine}</Text>
                        </ListItem>
                        <ListItem>
                            <Text size="sm">
                                {view.businessLine}
                                {view.publicLine === "" ? null : (
                                    <Text as="span" size="sm" tone="muted">
                                        {" "}
                                        ({view.publicLine})
                                    </Text>
                                )}
                            </Text>
                        </ListItem>
                    </List>
                    {view.emptyHint === "" ? null : (
                        <Text size="xs" tone="muted">
                            {view.emptyHint}
                        </Text>
                    )}
                    <div className={ROW}>
                        <TextAction href={view.knowledgeHref} size="sm" appearance="inline">
                            {view.knowledgeLabel}
                        </TextAction>
                        <TextAction href={view.nivoHref} size="sm" appearance="muted">
                            {view.nivoLabel}
                        </TextAction>
                    </div>
                </div>
            </SurfaceCard>
            <SurfaceCard label={view.notesTitle} headingLevel={2}>
                <div className={STACK}>
                    <Text size="xs" tone="muted">
                        {view.notesHint}
                    </Text>
                    {view.notes.length === 0 ? (
                        <Text size="sm" tone="muted">
                            {view.notesEmpty}
                        </Text>
                    ) : (
                        <>
                            <List label={view.notesTitle} className={NOTES}>
                                {view.notes.map((note) => (
                                    <ListItem key={note.id} className={NOTE}>
                                        <Text size="sm">{note.body}</Text>
                                        <Text size="xs" tone="muted">
                                            {note.meta}
                                        </Text>
                                        <div className={ROW}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                isDisabled={view.isPending}
                                                onPress={() => props.on.dismiss(note.id)}
                                            >
                                                {view.dismissLabel}
                                            </Button>
                                        </div>
                                    </ListItem>
                                ))}
                            </List>
                            <div className={ROW}>
                                <Button variant="primary" isPending={view.isPending} onPress={props.on.approve}>
                                    {view.approveLabel}
                                </Button>
                            </div>
                        </>
                    )}
                    {view.messageTone === "idle" ? null : (
                        <Alert
                            title={view.messageTitle}
                            description={view.messageText}
                            tone={view.messageTone === "applied" ? "affirmative" : "negative"}
                        />
                    )}
                </div>
            </SurfaceCard>
        </>
    )
}
