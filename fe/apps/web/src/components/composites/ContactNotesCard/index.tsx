import { SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
import type { ContactNoteView, ContactsPanesCopy } from "@/modules/types"

/** What the notes card draws. */
interface ContactNotesCardProps {
    readonly copy: Pick<ContactsPanesCopy, "notesTitle">
    readonly notes: ReadonlyArray<ContactNoteView>
    readonly isLoading: boolean
}

/** One piece of work an agent did for the person: its label, how it ended (the status label, 12 muted) and when (at the end). */
const rowOf = (note: ContactNoteView): ListRowData => ({
    id: note.id,
    title: note.title,
    ...(note.status === null
        ? {}
        : {
              description: (
                  <Text as="span" size="xs" tone="muted">
                      {note.status}
                  </Text>
              ),
          }),
    ...(note.time === "" ? {} : { meta: { text: note.time } }),
})

/** The work the agents did for the person, newest first, named by workflow and step labels and a status label, never by keys. Hidden when there is none. */
export const ContactNotesCard = (props: ContactNotesCardProps) =>
    props.notes.length === 0 ? null : (
        <SurfaceCard
            kind="list"
            label={props.copy.notesTitle}
            headingLevel={2}
            count={props.notes.length}
            isLoading={props.isLoading}
            items={props.notes.map((note) => rowOf(note))}
            empty={null}
        />
    )
