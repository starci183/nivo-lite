import { Alert, Select, Text } from "@starci/grammar/common"

/** The `isLoading` prop, spread only when the caller states it (an absent flag stays absent). */
const loadingOf = (isLoading: boolean | undefined) => (isLoading === undefined ? {} : { isLoading })

/** What the import step draws and reports. */
interface CsvImportRunProps {
    readonly isLoading?: boolean

    readonly intro: string
    /** The refresh schedule select of a Google Sheets import; null for other sources. */
    readonly schedule: {
        readonly label: string
        readonly value: string
        readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    } | null
    readonly isDisabled: boolean
    /** The import's outcome once it ran; null before. */
    readonly done: { readonly title: string; readonly description: string; readonly skipped: string | null } | null
    readonly onSchedule: (value: string | null) => void
}

/** The import step: what will be imported, the refresh schedule of a sheet, and the outcome once it ran. */
export const CsvImportRun = (props: CsvImportRunProps) => (
    <>
        <Text size="sm">{props.intro}</Text>
        {props.schedule === null ? null : (
            <Select
                {...loadingOf(props.isLoading)}
                label={props.schedule.label}
                isDisabled={props.isDisabled || props.done !== null}
                value={props.schedule.value}
                options={[...props.schedule.options]}
                onValueChange={props.onSchedule}
            />
        )}
        {props.done === null ? null : (
            <Alert
                {...loadingOf(props.isLoading)}
                tone="affirmative"
                title={props.done.title}
                description={props.done.description}
            />
        )}
        {props.done?.skipped ? (
            <Alert
                {...loadingOf(props.isLoading)}
                tone="informative"
                title={props.done.skipped}
            />
        ) : null}
    </>
)
