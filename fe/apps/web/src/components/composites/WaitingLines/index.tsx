import { Text } from "@starci/grammar/common"

/** One waiting line, with the id that keys it. */
export interface WaitingLine {
    readonly id: string
    readonly text: string
}

/** The lines and the skeleton flag the waiting card draws. */
type WaitingLinesProps = {
    readonly rows: ReadonlyArray<WaitingLine>
    readonly isSkeleton: boolean
}

/** Draws waiting lines while a redirect target is found. */
export const WaitingLines = (props: WaitingLinesProps) => (
    <>
        {props.rows.map((row) => (
            <Text key={row.id} isSkeleton={props.isSkeleton}>
                {row.text}
            </Text>
        ))}
    </>
)
