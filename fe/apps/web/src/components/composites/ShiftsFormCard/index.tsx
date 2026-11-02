import type { ShiftsSetupViews } from "@/modules/types"
type ShiftsFormView = ShiftsSetupViews["formCard"]
import {
    Button,
    Cluster,
    EmptyNotice,
    Grid,
    Input,
    Select,
    Stack,
    SurfaceCard,
    Switch,
    Text,
} from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"

/** The form view plus what its controls do. */
interface ShiftsFormCardProps extends ShiftsFormView {
    readonly isLoading?: boolean
    readonly on:
        | {
              readonly field: (id: string, value: string) => void
              readonly submit: () => void
              readonly available?: (value: boolean) => void
              readonly remove?: (id: string) => void
          }
        | undefined
}

type ShiftsFormBodyProps = Pick<
    ShiftsFormCardProps,
    | "fieldStructure"
    | "fields"
    | "isLoading"
    | "hint"
    | "switchLabel"
    | "switchOn"
    | "submitIntent"
    | "isBusy"
    | "canSubmit"
    | "submitLabel"
    | "on"
>

/** Resolves each fixed control from the form's current fields. */
const formFields = (props: Pick<ShiftsFormBodyProps, "fieldStructure" | "fields">) =>
    props.fieldStructure?.map((field) => {
        const current = props.fields.find((item) => item.id === field.id)
        return {
            ...field,
            value: current?.value ?? "",
            options: current?.options ?? [],
            control: fieldControl(field, current),
        }
    }) ?? props.fields

const FormBody = (props: ShiftsFormBodyProps) => {
    const on = props.on
    return (
        <Stack gap="row">
            <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                {props.hint}
            </Text>
            <Grid kind="form" columns={2}>
                {formFields(props).map((field) =>
                    (field.control ?? (field.options.length === 0 ? "input" : "select")) === "input" ? (
                        <Input
                            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                            key={field.id}
                            id={`shifts-field-${field.id}`}
                            name={field.id}
                            label={field.label}
                            value={field.value}
                            {...(on === undefined
                                ? {}
                                : { onValueChange: (value: string) => on.field(field.id, value) })}
                        />
                    ) : (
                        <Select
                            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                            key={field.id}
                            label={field.label}
                            name={field.id}
                            value={field.value === "" ? null : field.value}
                            options={field.options}
                            {...(on === undefined
                                ? {}
                                : { onValueChange: (value: string | null) => on.field(field.id, value ?? "") })}
                        />
                    ),
                )}
            </Grid>
            <Cluster gap="row">
                {props.switchLabel === null ? null : (
                    <Switch
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        label={props.switchLabel}
                        name="shifts-switch"
                        isSelected={props.switchOn}
                        {...(on?.available === undefined ? {} : { onSelectedChange: on.available })}
                    />
                )}
                <Button
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    intent={props.submitIntent}
                    isPending={props.isBusy}
                    isDisabled={!props.canSubmit}
                    {...(on === undefined ? {} : { onPress: on.submit })}
                >
                    {props.submitLabel}
                </Button>
            </Cluster>
        </Stack>
    )
}

/** Keeps the original two surface arrangements around the same native form body. */
export const ShiftsFormCard = (props: ShiftsFormCardProps) => {
    const body = <FormBody {...props} />
    const remove = props.on?.remove
    if (props.rows.length === 0)
        return (
            <SurfaceCard
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                label={props.title}
                headingLevel={2}
            >
                {body}
            </SurfaceCard>
        )
    return (
        <SurfaceCard
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            kind="bands"
            label={props.title}
            headingLevel={2}
            bands={[
                { kind: "body", children: body },
                {
                    kind: "list",
                    empty: <EmptyNotice message={props.hint} />,
                    items: props.rows.map((row): ListRowData => ({
                        id: row.id,
                        title: row.text,
                        ...(row.badge === null ? {} : { badges: [{ label: row.badge.label, tone: row.badge.tone }] }),
                        ...(row.actionLabel === null || remove === undefined
                            ? {}
                            : { action: { label: row.actionLabel, press: () => remove(row.id) } }),
                    })),
                },
            ]}
        />
    )
}

const fieldControl = (
    field: NonNullable<ShiftsSetupViews["formCard"]["fieldStructure"]>[number],
    current: ShiftsSetupViews["formField"] | undefined,
): "input" | "select" => {
    if (current === undefined) return field.control
    return current.control ?? (current.options.length === 0 ? "input" : "select")
}
