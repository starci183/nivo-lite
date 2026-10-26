import { Checkbox, Input, Select, Text } from "@starci/grammar/common"
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
    readonly rows: ReadonlyArray<OpenApiPullRow>
    readonly entityOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly query: string
    readonly isEmpty: boolean
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
    readonly step: Pick<OpenApiPullsStepProps, "text" | "isDisabled" | "entityOptions" | "onPatch">
}

/** The settings of one ticked operation, indented under its checkbox. */
const PullSettings = (props: PullSettingsProps) => {
    const { row, step } = props
    if (row.pull === null) return null
    const { text, isDisabled } = step
    const patch = (field: OpenApiPullField) => (value: string | null) => step.onPatch(row.id, field, value)
    return (
        <div className={classNames.nested}>
            <Select
                label={text.entity}
                isDisabled={isDisabled}
                options={step.entityOptions}
                value={row.pull.entity}
                onValueChange={patch("entity")}
            />
            <Input
                id={`oa-path-${row.id}`}
                name="itemsPath"
                label={text.itemsPath}
                hint={text.itemsPathHint}
                isDisabled={isDisabled}
                value={row.pull.itemsPath}
                onValueChange={patch("itemsPath")}
            />
            <Input
                id={`oa-id-${row.id}`}
                name="idField"
                label={text.idField}
                isDisabled={isDisabled}
                value={row.pull.idField}
                onValueChange={patch("idField")}
            />
            <Input
                id={`oa-title-${row.id}`}
                name="titleField"
                label={text.titleField}
                isDisabled={isDisabled}
                value={row.pull.titleField}
                onValueChange={patch("titleField")}
            />
            {row.fixedQueryHint === null ? null : (
                <Input
                    id={`oa-q-${row.id}`}
                    name="fixedQuery"
                    label={text.fixedQuery}
                    hint={row.fixedQueryHint}
                    isDisabled={isDisabled}
                    value={row.pull.fixedQuery}
                    onValueChange={patch("fixedQuery")}
                />
            )}
        </div>
    )
}

/** Step "pulls" of the OpenAPI wizard: tick the GET operations NIVO pulls on a schedule, and map their response. */
export const OpenApiPullsStep = (props: OpenApiPullsStepProps) => {
    const step = {
        text: props.text,
        isDisabled: props.isDisabled,
        entityOptions: props.entityOptions,
        onPatch: props.onPatch,
    }
    return (
        <div className={classNames.column}>
            <Text size="sm" tone="muted">
                {props.text.hint}
            </Text>
            <Input
                id="oa-pull-search"
                name="pullSearch"
                label={props.text.search}
                value={props.query}
                onValueChange={props.onQuery}
            />
            {props.isEmpty ? <Text size="sm">{props.text.empty}</Text> : null}
            <div className={classNames.list}>
                {props.rows.map((row) => (
                    <div key={row.id} className={classNames.row}>
                        <Checkbox
                            label={row.label}
                            description={row.description}
                            isDisabled={props.isDisabled || !row.isPullable}
                            isSelected={row.pull !== null}
                            onSelectedChange={(on) => props.onToggle(row.id, on)}
                        />
                        <PullSettings row={row} step={step} />
                    </div>
                ))}
            </div>
            {props.tooMany === null ? null : (
                <Text size="sm" tone="muted">
                    {props.tooMany}
                </Text>
            )}
        </div>
    )
}
