import { CheckboxGroup, Input, Text } from "@starci/grammar/common"
import { openApiToolsStepClassNames as classNames } from "./classNames"

/** What the agent-tools step of the OpenAPI wizard draws and reports. */
type OpenApiToolsStepProps = {
    /** The operations the search shows, each with its label and what it does. */
    readonly options: ReadonlyArray<{
        readonly value: string
        readonly label: string
        readonly description?: string | undefined
    }>
    /** The ticked operations among those shown. */
    readonly value: ReadonlyArray<string>
    readonly query: string
    readonly isDisabled: boolean
    readonly text: Readonly<Record<"hint" | "search" | "empty" | "label", string>>
    readonly onQuery: (value: string) => void
    readonly onChange: (ids: ReadonlyArray<string>) => void
}

/** Step "tools" of the OpenAPI wizard: tick the operations agents may call as tools (any method). */
export const OpenApiToolsStep = (props: OpenApiToolsStepProps) => (
    <div className={classNames.column}>
        <Text size="sm" tone="muted">
            {props.text.hint}
        </Text>
        <Input
            id="oa-tool-search"
            name="toolSearch"
            label={props.text.search}
            value={props.query}
            onValueChange={props.onQuery}
        />
        {props.options.length === 0 ? (
            <Text size="sm">{props.text.empty}</Text>
        ) : (
            <div className={classNames.list}>
                <CheckboxGroup
                    label={props.text.label}
                    isLabelHidden
                    isDisabled={props.isDisabled}
                    options={props.options}
                    value={[...props.value]}
                    onValueChange={(ids) => props.onChange(ids)}
                />
            </div>
        )}
    </div>
)
