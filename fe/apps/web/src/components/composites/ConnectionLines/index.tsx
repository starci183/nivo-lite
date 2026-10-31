import { Badge, List, ListRow } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"

/** One line of a connection list: what it is, the line under it and the verdict badge. */
interface ConnectionLine {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badge: { readonly label: string; readonly tone: BadgeTone; readonly isDot?: boolean }
}

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
