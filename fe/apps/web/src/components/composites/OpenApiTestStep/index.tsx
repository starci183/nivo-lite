import { Alert, Input, Select, Text } from "@starci/grammar/common"
import type { WizardNote } from "@/modules/types"
import { openApiTestStepClassNames as classNames } from "./classNames"

/** What the test step of the OpenAPI wizard draws and reports. */
type OpenApiTestStepProps = {
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
    <div className={classNames.column}>
        <Text size="sm" tone="muted">
            {props.text.hint}
        </Text>
        {props.options.length === 0 ? (
            <Text size="sm">{props.text.empty}</Text>
        ) : (
            <Select
                label={props.text.operation}
                variant="secondary"
                options={props.options}
                value={props.value}
                onValueChange={props.onOperation}
            />
        )}
        {props.showQuery ? (
            <Input
                id="oa-test-q"
                name="testQuery"
                label={props.text.query}
                variant="secondary"
                value={props.query}
                onValueChange={props.onQuery}
            />
        ) : null}
        {props.isTesting ? (
            <Text size="sm" live="polite">
                {props.text.testing}
            </Text>
        ) : null}
        {props.note === null ? null : <Alert tone={props.note.tone} title={props.note.text} />}
        {props.fields === null ? null : (
            <Text size="sm" tone="muted">
                {props.fields}
            </Text>
        )}
    </div>
)
