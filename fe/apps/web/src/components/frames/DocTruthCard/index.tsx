import { Button, EmptyNotice, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DocTruthControlView, DocTruthRowView } from "@/modules/types"

/** The words of the card. */
interface DocTruthCardCopy {
    readonly label: string
    readonly view: string
    readonly emptyTitle: string
    readonly emptyBody: string
}

/** What the list of documents draws and calls. */
interface DocTruthCardProps {
    readonly rows: ReadonlyArray<DocTruthRowView>
    readonly copy: DocTruthCardCopy
    readonly isLoading: boolean
    readonly onView: (id: string) => void
    /** Opens the row: the drawer with the facts the document gave. */
    readonly onOpen: (id: string) => void
    readonly onControl: (id: string, kind: DocTruthControlView["kind"]) => void
}

/** The chips of a row as Grammar's badge data (at most two): results have no dot, a live step has one; nothing when the row has none. */
const badgesOf = (row: DocTruthRowView): Pick<ListRowData, "badges"> => {
    const [first, second] = row.chips
    if (first === undefined) return {}
    const one = { label: first.label, tone: first.tone, isDot: first.isDot }
    if (second === undefined) return { badges: [one] }
    return { badges: [one, { label: second.label, tone: second.tone, isDot: second.isDot }] }
}

/** The one neutral small command of a row beyond "Xem" (answer, try again, top up); nothing when the row has none. */
const controlOf = (row: DocTruthRowView, onControl: DocTruthCardProps["onControl"]): ReactNode => {
    const { control } = row
    return control === null ? undefined : (
        <Button
            size="sm"
            intent="neutral"
            isPending={control.isPending}
            onPress={() => onControl(row.id, control.kind)}
        >
            {control.label}
        </Button>
    )
}

/**
 * The documents of the shop as one list card: the name with the line that says whether it is found and where its truths stand, the
 * chips of the result at the end, then "Xem" and, when a row has one, a neutral small command. Rows are 12 muted under the name.
 */
export const DocTruthCard = (props: DocTruthCardProps) => {
    const { copy } = props
    const items: ReadonlyArray<ListRowData> = props.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: (
            <Text size="xs" tone="muted">
                {row.meta}
            </Text>
        ),
        ...badgesOf(row),
        action: { label: copy.view, press: () => props.onView(row.id) },
        actionPlacement: "end",
        control: controlOf(row, props.onControl),
        onPress: () => props.onOpen(row.id),
    }))
    return (
        <SurfaceCard
            kind="list"
            ariaLabel={copy.label}
            isLoading={props.isLoading}
            items={[...items]}
            empty={
                <EmptyNotice
                    message={copy.emptyTitle}
                    iconSource={nivoIconSource("document", "leading")}
                    description={copy.emptyBody}
                />
            }
        />
    )
}
