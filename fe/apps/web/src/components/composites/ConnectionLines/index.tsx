import { EmptyNotice, Section, type BadgeTone, type ListRowData } from "@starci/grammar/common"

/** One line of a connection list: what it is, the line under it and the verdict badge. */
interface ConnectionLine {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badge: { readonly label: string; readonly tone: BadgeTone; readonly isDot?: boolean }
    /** A command on the line (retry a failed file). */
    readonly action?: { readonly label: string; readonly run: () => void }
}

/** Fake rows of the same shape: a block's skeleton reuses the ready tree. */
export const CONNECTION_LINES_PLACEHOLDER: ReadonlyArray<ConnectionLine> = [
    { id: "one", title: "-", description: "-", badge: { label: "-", tone: "neutral" } },
    { id: "two", title: "-", description: "-", badge: { label: "-", tone: "neutral" } },
    { id: "three", title: "-", description: "-", badge: { label: "-", tone: "neutral" } },
]

/** Props for {@link ConnectionLines}. */
type ConnectionLinesProps = {
    readonly label: string
    readonly lines: ReadonlyArray<ConnectionLine>
    readonly isSkeleton: boolean
}

/** The lines of a connection (checks, events) as a list whose rows carry a verdict badge. */
export const ConnectionLines = (props: ConnectionLinesProps) => (
    <Section
        kind="list"
        title={props.label}
        headingLevel={3}
        isLoading={props.isSkeleton}
        items={props.lines.map((line): ListRowData => ({
            id: line.id,
            title: line.title,
            description: line.description,
            badges: [
                {
                    label: line.badge.label,
                    tone: line.badge.tone,
                    ...(line.badge.isDot === true ? { isDot: true } : {}),
                },
            ],
            ...(line.action === undefined ? {} : { action: { label: line.action.label, press: line.action.run } }),
        }))}
        empty={<EmptyNotice message={props.label} />}
    />
)
