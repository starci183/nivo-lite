import { Badge, Button, List, ListRow } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"

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
    <List label={props.label} aria-busy={props.isSkeleton}>
        {props.lines.map((line) => (
            <ListRow
                key={line.id}
                title={line.title}
                description={line.description}
                isSkeleton={props.isSkeleton}
                actions={
                    line.action === undefined ? undefined : (
                        <Button intent="neutral" size="sm" onPress={line.action.run}>
                            {line.action.label}
                        </Button>
                    )
                }
                badges={
                    <Badge
                        tone={line.badge.tone}
                        isSkeleton={props.isSkeleton}
                        {...(line.badge.isDot === true ? { isDot: true } : {})}
                    >
                        {line.badge.label}
                    </Badge>
                }
            />
        ))}
    </List>
)
