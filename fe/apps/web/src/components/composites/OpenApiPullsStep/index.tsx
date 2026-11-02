import { Checkbox, Input, Select, Text, Stack } from "@starci/grammar/common"
import { openApiPullsStepClassNames as classNames } from "./classNames"
/** A setting of a pulled endpoint. */
type OpenApiPullField = "entity" | "itemsPath" | "idField" | "titleField" | "fixedQuery"

/** One GET operation of the list and, when ticked, its pull settings. */
type OpenApiPullRow = {
    readonly id: string
    readonly label: string
    readonly description: string | undefined
    /** False for a GET with a path parameter: it cannot run on a schedule. */
    readonly isPullable: boolean
    readonly pull: Readonly<Record<OpenApiPullField, string>> | null
    /** The fixed-parameters hint naming the required query parameters; null when the operation has none. */
    readonly fixedQueryHint: string | null
}

/** What the pulled-data step of the OpenAPI wizard draws and reports. */
type OpenApiPullsStepProps = {
    readonly isLoading?: boolean

    readonly rows: ReadonlyArray<OpenApiPullRow>
    readonly entityOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly query: string
    readonly unavailableReason: string | null
    /** "Showing the first n" when the search matches more than fit; null otherwise. */
    readonly tooMany: string | null
    readonly isDisabled: boolean
    readonly text: Readonly<
        Record<
            | "hint"
            | "search"
            | "empty"
            | "entity"
            | "itemsPath"
            | "itemsPathHint"
            | "idField"
            | "titleField"
            | "fixedQuery",
            string
        >
    >
    readonly onQuery: (value: string) => void
    readonly onToggle: (opId: string, on: boolean) => void
    readonly onPatch: (opId: string, field: OpenApiPullField, value: string | null) => void
}

/** One row of the step and the step it belongs to. */
type PullSettingsProps = {
    readonly row: OpenApiPullRow
    readonly step: Pick<OpenApiPullsStepProps, "text" | "isDisabled" | "isLoading" | "entityOptions" | "onPatch">
}

/** The settings of one ticked operation, indented under its checkbox. */
const PullSettings = (props: PullSettingsProps) => {
    const { row, step } = props
    if (row.pull === null) return null
    const { text, isDisabled } = step
    const patch = (field: OpenApiPullField) => (value: string | null) => step.onPatch(row.id, field, value)
    return (
        <Stack gap="row">
            <Select
                {...(props.step.isLoading === undefined ? {} : { isLoading: props.step.isLoading })}
                label={text.entity}
                isDisabled={isDisabled}
                options={step.entityOptions}
                value={row.pull.entity}
                onValueChange={patch("entity")}
            />
            {pullFieldsOf(row, step.text).map((field) => (
                <Input
                    key={field.name}
                    {...(step.isLoading === undefined ? {} : { isLoading: step.isLoading })}
                    id={field.id}
                    name={field.name}
                    label={field.label}
                    {...(field.description === undefined ? {} : { description: field.description })}
                    isDisabled={isDisabled}
                    value={field.value}
                    onValueChange={patch(field.name)}
                />
            ))}
        </Stack>
    )
}

/** Step "pulls" of the OpenAPI wizard: tick the GET operations NIVO pulls on a schedule, and map their response. */
export const OpenApiPullsStep = (props: OpenApiPullsStepProps) => {
    const step = {
        text: props.text,
        isDisabled: props.isDisabled,
        ...(props.isLoading === undefined ? {} : { isLoading: props.isLoading }),
        entityOptions: props.entityOptions,
        onPatch: props.onPatch,
    }
    return (
        <Stack gap="section">
            <Text size="sm" tone="muted">
                {props.text.hint}
            </Text>
            <Input
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                id="oa-pull-search"
                name="pullSearch"
                label={props.text.search}
                value={props.query}
                onValueChange={props.onQuery}
            />
            {props.unavailableReason !== null && props.isLoading !== true ? (
                <Text size="sm">{props.unavailableReason}</Text>
            ) : null}
            <div className={classNames.list}>
                <Stack gap="row">
                    {props.rows.map((row) => (
                        <Stack gap="row" key={row.id}>
                            <Checkbox
                                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                label={row.label}
                                description={row.description}
                                isDisabled={props.isDisabled || !row.isPullable}
                                isSelected={row.pull !== null}
                                onSelectedChange={(on) => props.onToggle(row.id, on)}
                            />
                            <PullSettings row={row} step={step} />
                        </Stack>
                    ))}
                </Stack>
            </div>
            {props.tooMany === null ? null : (
                <Text size="sm" tone="muted">
                    {props.tooMany}
                </Text>
            )}
        </Stack>
    )
}

interface PullTextField {
    readonly id: string
    readonly name: Exclude<OpenApiPullField, "entity">
    readonly label: string
    readonly description?: string
    readonly value: string
}
/** Keeps every saved pull mapping, adding the fixed-query control only for an operation that needs it. */
const pullFieldsOf = (row: OpenApiPullRow, text: OpenApiPullsStepProps["text"]): ReadonlyArray<PullTextField> => {
    if (row.pull === null) return []
    const fields: PullTextField[] = [
        {
            id: `oa-path-${row.id}`,
            name: "itemsPath",
            label: text.itemsPath,
            description: text.itemsPathHint,
            value: row.pull.itemsPath,
        },
        { id: `oa-id-${row.id}`, name: "idField", label: text.idField, value: row.pull.idField },
        { id: `oa-title-${row.id}`, name: "titleField", label: text.titleField, value: row.pull.titleField },
    ]
    if (row.fixedQueryHint !== null)
        fields.push({
            id: `oa-q-${row.id}`,
            name: "fixedQuery",
            label: text.fixedQuery,
            description: row.fixedQueryHint,
            value: row.pull.fixedQuery,
        })
    return fields
}
