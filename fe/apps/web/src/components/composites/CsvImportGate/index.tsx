import { Alert, Button, Text } from "@starci/grammar/common"

/** What the wizard shows before the saved import it resumes is known. */
interface CsvImportGateProps {
    /** The sentence shown while the saved import loads. */
    readonly message: string
    /** Why the saved import could not load (already localized by the back end); null while it still loads. */
    readonly failure: string | null
    readonly closeLabel: string
    readonly onClose: () => void
}

/** The saved import still loading, or why it could not load, with a way out. */
export const CsvImportGate = (props: CsvImportGateProps) =>
    props.failure === null ? (
        <Text size="sm" tone="muted" live="polite">
            {props.message}
        </Text>
    ) : (
        <>
            <Alert tone="negative" title={props.failure} />
            <Button intent="neutral" onPress={props.onClose}>
                {props.closeLabel}
            </Button>
        </>
    )
