import { Alert, Input, Select, Text, Stack } from "@starci/grammar/common"
import type { WizardNote } from "@/modules/types"

/** What the test step of the OpenAPI wizard draws and reports. */
type OpenApiTestStepProps = {
    readonly isLoading?: boolean

    /** The GET operations that can be tried; empty shows the "no GET" line. */
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly value: string | null
    /** The tried operation is not pulled, so its query parameters are typed here. */
    readonly showQuery: boolean
    readonly query: string
    readonly isTesting: boolean
    /** What the call answered; null before a test. */
    readonly note: WizardNote | null
    /** The fields of the first item found; null when there is none. */
    readonly fields: string | null
    readonly text: Readonly<Record<"hint" | "empty" | "operation" | "query" | "testing", string>>
    readonly onOperation: (id: string | null) => void
    readonly onQuery: (value: string) => void
}

/** Step "test" of the OpenAPI wizard: calls one GET with the typed settings and shows what came back. */
export const OpenApiTestStep = (props: OpenApiTestStepProps) => (
    <Stack gap="section">
        <Text size="sm" tone="muted">
            {props.text.hint}
        </Text>
        <TestOperation
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            options={props.options}
            value={props.value}
            text={props.text}
            onOperation={props.onOperation}
        />
        {props.showQuery ? (
            <Input
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                id="oa-test-q"
                name="testQuery"
                label={props.text.query}
                value={props.query}
                onValueChange={props.onQuery}
            />
        ) : null}
        {props.isTesting ? (
            <Text size="sm" live="polite">
                {props.text.testing}
            </Text>
        ) : null}
        {props.note === null ? null : (
            <Alert
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                tone={props.note.tone}
                title={props.note.text}
            />
        )}
        {props.fields === null ? null : (
            <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                {props.fields}
            </Text>
        )}
    </Stack>
)

/** Known capability copy stays real while unresolved options use their native control anatomy. */
const TestOperation = (
    props: Pick<OpenApiTestStepProps, "isLoading" | "options" | "value" | "text" | "onOperation">,
) => {
    if (props.options.length === 0) {
        if (props.isLoading === true) return null
        return <Text size="sm">{props.text.empty}</Text>
    }
    return (
        <Select
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.text.operation}
            options={props.options}
            value={props.value}
            onValueChange={props.onOperation}
        />
    )
}
