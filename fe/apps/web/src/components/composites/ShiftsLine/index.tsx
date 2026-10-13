import { Text } from "@starci/grammar/common"
import { LINE_CLASS_NAME } from "./classNames"

/** What a line of the shifts lists says. */
interface ShiftsLineProps {
    readonly title: string
    /** Facts under the title; empty lines are not drawn. */
    readonly notes: ReadonlyArray<string>
}

/** A semibold title over its muted facts, as the rows of the shifts lists show a shift, a person or a request. */
export const ShiftsLine = (props: ShiftsLineProps) => (
    <div className={LINE_CLASS_NAME}>
        <Text size="sm" weight="semibold">
            {props.title}
        </Text>
        {props.notes
            .filter((note) => note !== "")
            .map((note) => (
                <Text key={note} size="xs" tone="muted">
                    {note}
                </Text>
            ))}
    </div>
)
