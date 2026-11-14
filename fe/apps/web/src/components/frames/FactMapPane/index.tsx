import { Badge, Button, Cluster, Heading, Icon, ListBox, PaneSection, Stack, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { FactMapPaneView } from "@/modules/brain"

/** Props for {@link FactMapPane}. */
interface FactMapPaneProps {
    /** The selected node; null while nothing is selected. */
    readonly view: FactMapPaneView | null
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly readersNone: string
    readonly on: {
        readonly approve: () => void
        readonly edit: () => void
        readonly compare: () => void
    }
}

/** The props of Actions. */
interface ActionsProps {
    readonly view: FactMapPaneView
    readonly on: FactMapPaneProps["on"]
}

/** The actions of the selected fact: Approve is the primary when a value waits, Edit and the comparison beside it. */
const Actions = (props: ActionsProps) => {
    const { view, on } = props
    if (view.approve === null && view.edit === null && view.compare === null) return null
    return (
        <Cluster gap="inline">
            {view.approve === null ? null : (
                <Button
                    intent="commit"
                    isPending={view.approve.isPending}
                    onPress={on.approve}
                >
                    {view.approve.label}
                </Button>
            )}
            {view.compare === null ? null : (
                <Button intent="neutral" onPress={on.compare}>
                    {view.compare.label}
                </Button>
            )}
            {view.edit === null ? null : (
                <Button
                    intent="neutral"
                    onPress={on.edit}
                >
                    {view.edit.label}
                </Button>
            )}
        </Cluster>
    )
}

/** The props of Documents. */
interface DocumentsProps {
    readonly view: FactMapPaneView
}

/** The documents the node cites, as a list under its heading. */
const Documents = (props: DocumentsProps) =>
    props.view.documents.length === 0 ? null : (
        <Stack gap="row">
            <Heading level={4}>{props.view.documentsTitle}</Heading>
            <ListBox
                label={props.view.documentsTitle}
                size="sm"
                items={props.view.documents.map((doc) => ({
                    id: doc.id,
                    label: doc.title,
                    leading: <Icon source={nivoIconSource("document", "leading")} usage="leading" />,
                }))}
            />
        </Stack>
    )

/** The props of Readers. */
interface ReadersProps {
    readonly view: FactMapPaneView
    readonly none: string
}

/** The agents that read the fact, as a list under its heading; a subject has no readers of its own. */
const Readers = (props: ReadersProps) => {
    if (props.view.value === null) return null
    return (
        <Stack gap="row">
            <Heading level={4}>{props.view.readersTitle}</Heading>
            {props.view.readers.length === 0 ? (
                <Text size="sm" tone="muted">
                    {props.none}
                </Text>
            ) : (
                <ListBox
                    label={props.view.readersTitle}
                    size="sm"
                    items={props.view.readers.map((reader) => ({
                        id: reader.id,
                        label: reader.name,
                        meta: reader.line,
                    }))}
                />
            )}
        </Stack>
    )
}

/**
 * The side pane of the map, inside the card: the label of the selected node, its value, the status chips, the documents it comes from,
 * the agents that read it and its actions. With nothing selected it says what to do.
 */
export const FactMapPane = (props: FactMapPaneProps) => {
    const { view } = props
    if (view === null) {
        return (
            <PaneSection gap="row">
                <Heading level={3}>{props.emptyTitle}</Heading>
                <Text size="sm" tone="muted">
                    {props.emptyBody}
                </Text>
            </PaneSection>
        )
    }
    return (
        <PaneSection gap="section">
            <Stack gap="row">
                <Stack gap="identity">
                    <Heading level={3}>{view.title}</Heading>
                    <Text size="sm" tone="muted">
                        {view.description}
                    </Text>
                </Stack>
                {view.value === null ? null : <Heading level={4}>{view.value.text}</Heading>}
                <Cluster gap="inline">
                    {view.badges.map((badge) => (
                        <Badge key={badge.label} tone={badge.tone}>
                            {badge.label}
                        </Badge>
                    ))}
                </Cluster>
                <Actions view={view} on={props.on} />
            </Stack>
            <Documents view={view} />
            <Readers view={view} none={props.readersNone} />
        </PaneSection>
    )
}
