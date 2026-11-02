import { CheckboxGroup, Input, Text, Stack } from "@starci/grammar/common"
import { openApiToolsStepClassNames as classNames } from "./classNames"
/** What the agent-tools step of the OpenAPI wizard draws and reports. */
type OpenApiToolsStepProps = {
    readonly isLoading?: boolean

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
    <Stack gap="section">
        <Text size="sm" tone="muted">
            {props.text.hint}
        </Text>
        <Input
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            id="oa-tool-search"
            name="toolSearch"
            label={props.text.search}
            value={props.query}
            onValueChange={props.onQuery}
        />
        <ToolChoices
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            options={props.options}
            value={props.value}
            isDisabled={props.isDisabled}
            text={props.text}
            onChange={props.onChange}
        />
    </Stack>
)

/** Known capability copy stays real while unresolved options use their native control anatomy. */
const ToolChoices = (
    props: Pick<OpenApiToolsStepProps, "isLoading" | "options" | "value" | "isDisabled" | "text" | "onChange">,
) => {
    if (props.options.length === 0) {
        if (props.isLoading === true) return null
        return <Text size="sm">{props.text.empty}</Text>
    }
    return (
        <div className={classNames.list}>
            <CheckboxGroup
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                label={props.text.label}
                isLabelHidden
                isDisabled={props.isDisabled}
                options={props.options}
                value={[...props.value]}
                onValueChange={(ids) => props.onChange(ids)}
            />
        </div>
    )
}
