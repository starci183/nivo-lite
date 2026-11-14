import { EmptyNotice, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ContactFactView, ContactNoteView, ContactsPanesCopy } from "@/modules/types"

/** What the memory cards draw and do. */
interface ContactMemoryCardsProps {
    readonly copy: Pick<
        ContactsPanesCopy,
        "memoryTitle" | "memoryEmpty" | "forgetLabel" | "rowMenuLabel" | "notesTitle"
    >
    readonly facts: ReadonlyArray<ContactFactView>
    readonly notes: ReadonlyArray<ContactNoteView>
    readonly isLoading: boolean
    readonly onForget: (name: string) => void
}

/** One fact the agents remember: its name, its value at the end, and the command that makes them forget it. */
const factRowOf = (fact: ContactFactView, props: ContactMemoryCardsProps): ListRowData => ({
    id: fact.name,
    title: fact.name,
    value: fact.value,
    menu: {
        label: props.copy.rowMenuLabel,
        entries: [
            {
                kind: "section",
                id: "fact",
                items: [
                    {
                        id: "forget",
                        label: props.copy.forgetLabel,
                        tone: "danger" as const,
                        onAction: () => props.onForget(fact.name),
                    },
                ],
            },
        ],
    },
})

/** One step outcome the agents remember: the workflow and the step, what came of it, and when. */
const noteRowOf = (note: ContactNoteView): ListRowData => ({
    id: note.id,
    title: note.title,
    description: note.text,
    ...(note.time === "" ? {} : { meta: { text: note.time } }),
})

/**
 * What the agents remember about the person: the facts as key and value rows each with "forget", and, when there are any, the step
 * outcomes they keep as a second card. Each is one card with one kind of row.
 */
export const ContactMemoryCards = (props: ContactMemoryCardsProps) => (
    <>
        <SurfaceCard
            kind="list"
            layout="keyValue"
            label={props.copy.memoryTitle}
            headingLevel={2}
            count={props.facts.length}
            isLoading={props.isLoading}
            items={props.facts.map((fact) => factRowOf(fact, props))}
            empty={<EmptyNotice message={props.copy.memoryEmpty} iconSource={nivoIconSource("brain", "leading")} />}
        />
        {props.notes.length === 0 ? null : (
            <SurfaceCard
                kind="list"
                label={props.copy.notesTitle}
                headingLevel={2}
                count={props.notes.length}
                isLoading={props.isLoading}
                items={props.notes.map((note) => noteRowOf(note))}
                empty={null}
            />
        )}
    </>
)
