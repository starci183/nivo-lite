import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
type ShiftsDemandProps = ShiftsSetupViews["demand"] & {
    readonly on: ShiftsSetupActions["demand"] | undefined
    readonly isLoading?: boolean
}
import { NumberField, Section, Select, Switch, TagGroup, Text, Stack, Grid, Cluster } from "@starci/grammar/common"
import { ShiftsSetupCard } from "@/components/branches/ShiftsSetupCard"
import { ShiftsActionButton } from "@/components/leaves/ShiftsActionButton"
import { ShiftsCheckboxes } from "@/components/leaves/ShiftsCheckboxes"

/** Draws the coverage blocks by weekday and the form that adds blocks over several days. */
export const ShiftsDemand = (props: ShiftsDemandProps) => (
    <ShiftsSetupCard
        title={props.title}
        hint={props.hint}
        isLoading={props.isLoading}
        body={
            <>
                {props.hasBlocks ? (
                    <Grid kind="form" columns={2}>
                        {props.groups.map((group) => (
                            <Stack gap="identity" key={group.id}>
                                <TagGroup
                                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                    label={group.label}
                                    size="sm"
                                    items={group.blocks}
                                    onRemove={(ids) => ids.forEach((id) => props.on?.remove(id))}
                                    removeLabel={(label) => `${props.removeLabel} ${label}`}
                                    emptyContent={
                                        <Text
                                            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                            size="xs"
                                            tone="muted"
                                        >
                                            -
                                        </Text>
                                    }
                                />
                            </Stack>
                        ))}
                    </Grid>
                ) : (
                    <Text
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        size="sm"
                        tone="muted"
                    >
                        {props.emptyLabel}
                    </Text>
                )}
                <Section
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    headingLevel={3}
                    title={props.addTitle}
                >
                    <ShiftsCheckboxes
                        label={props.labels.days}
                        options={props.dayOptions}
                        value={props.form.days}
                        onValueChange={props.on?.days}
                        isLoading={props.isLoading}
                    />
                    {renderDemandFields({ props })}
                    <Cluster gap="row" align="center">
                        <Switch
                            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                            label={props.labels.peak}
                            name="peak"
                            isSelected={props.form.peak}
                            {...(props.on === undefined ? {} : { onSelectedChange: props.on.peak })}
                        />
                        <ShiftsActionButton
                            isLoading={props.isLoading}
                            intent="commit"
                            isPending={props.isBusy}
                            isDisabled={!props.canAdd}
                            onPress={props.on?.add}
                            label={props.addLabel}
                        />
                    </Cluster>
                </Section>
            </>
        }
    />
)

/** The three choices of a coverage block, each with the command that sets it. */
const choicesOf = (props: ShiftsDemandProps) => [
    {
        name: "cstart",
        label: props.labels.from,
        value: props.form.start,
        options: props.timeOptions,
        set: props.on?.start,
    },
    { name: "cend", label: props.labels.to, value: props.form.end, options: props.timeOptions, set: props.on?.end },
    {
        name: "cpos",
        label: props.labels.position,
        value: props.form.positionId,
        options: props.positionOptions,
        set: props.on?.position,
    },
]

const renderDemandFields = ({ props }: RenderDemandFieldsInput) => (
    <Grid kind="form" columns={2}>
        {choicesOf(props).map((choice) => (
            <Select
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                key={choice.name}
                label={choice.label}
                name={choice.name}
                value={choice.value}
                options={choice.options}
                onValueChange={(value) => {
                    if (value !== null) choice.set?.(value)
                }}
            />
        ))}
        <NumberField
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.labels.min}
            name="cmin"
            value={props.form.min}
            minValue={0}
            maxValue={50}
            {...(props.on === undefined ? {} : { onValueChange: props.on.min })}
        />
        <NumberField
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.labels.ideal}
            name="cideal"
            value={props.form.ideal}
            minValue={props.form.min}
            maxValue={50}
            {...(props.on === undefined ? {} : { onValueChange: props.on.ideal })}
        />
    </Grid>
)

type RenderDemandFieldsInput = { props: ShiftsDemandProps }
