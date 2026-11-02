import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
type ShiftsDemandProps = ShiftsSetupViews["demand"] & {
    readonly on: ShiftsSetupActions["demand"] | undefined
    readonly isLoading?: boolean
}
import {
    Button,
    CheckboxGroup,
    NumberField,
    Section,
    Select,
    SurfaceCard,
    Switch,
    TagGroup,
    Text,
    Stack,
    Grid,
    Cluster,
} from "@starci/grammar/common"

/** Draws the coverage blocks by weekday and the form that adds blocks over several days. */
export const ShiftsDemand = (props: ShiftsDemandProps) => (
    <SurfaceCard
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
        label={props.title}
        headingLevel={2}
    >
        <Stack gap="row">
            <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                {props.hint}
            </Text>
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
                <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                    {props.emptyLabel}
                </Text>
            )}
            <Section
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                headingLevel={3}
                title={props.addTitle}
            >
                <CheckboxGroup
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    label={props.labels.days}
                    orientation="horizontal"
                    options={props.dayOptions}
                    value={props.form.days}
                    {...(props.on === undefined ? {} : { onValueChange: props.on.days })}
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
                    <Button
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        intent="commit"
                        isPending={props.isBusy}
                        isDisabled={!props.canAdd}
                        {...(props.on === undefined ? {} : { onPress: props.on.add })}
                    >
                        {props.addLabel}
                    </Button>
                </Cluster>
            </Section>
        </Stack>
    </SurfaceCard>
)

const renderDemandFields = ({ props }: RenderDemandFieldsInput) => (
    <Grid kind="form" columns={2}>
        <Select
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.labels.from}
            name="cstart"
            value={props.form.start}
            options={props.timeOptions}
            onValueChange={(value) => {
                if (value !== null) props.on?.start(value)
            }}
        />
        <Select
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.labels.to}
            name="cend"
            value={props.form.end}
            options={props.timeOptions}
            onValueChange={(value) => {
                if (value !== null) props.on?.end(value)
            }}
        />
        <Select
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.labels.position}
            name="cpos"
            value={props.form.positionId}
            options={props.positionOptions}
            onValueChange={(value) => {
                if (value !== null) props.on?.position(value)
            }}
        />
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
