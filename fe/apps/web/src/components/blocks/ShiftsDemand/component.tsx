import {
    Button,
    CheckboxGroup,
    NumberField,
    SectionHeader,
    Select,
    SurfaceCard,
    Switch,
    TagGroup,
    Text,
} from "@starci/grammar/common"
import { BLOCK_CLASS_NAME, DAYS_CLASS_NAME, FORM_GRID_CLASS_NAME, ROW_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** What is typed in the coverage form. */
export interface DemandForm {
    readonly days: ReadonlyArray<string>
    readonly start: string
    readonly end: string
    readonly positionId: string
    readonly min: number
    readonly ideal: number
    readonly peak: boolean
}

/** One select choice. */
interface OptionView {
    readonly id: string
    readonly label: string
}

/** The coverage blocks of one weekday. */
interface DemandGroupView {
    readonly id: string
    readonly label: string
    readonly blocks: ReadonlyArray<OptionView>
}

/** Copy, blocks and form state the connected demand card supplies. */
export interface ShiftsDemandBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly emptyLabel: string
        readonly addTitle: string
        readonly addLabel: string
        readonly removeLabel: string
        readonly labels: {
            readonly days: string
            readonly from: string
            readonly to: string
            readonly position: string
            readonly min: string
            readonly ideal: string
            readonly peak: string
        }
        readonly groups: ReadonlyArray<DemandGroupView>
        readonly dayOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly timeOptions: ReadonlyArray<OptionView>
        readonly positionOptions: ReadonlyArray<OptionView>
        readonly form: DemandForm
        readonly hasBlocks: boolean
        readonly isBusy: boolean
        readonly canAdd: boolean
    }
    readonly on: {
        readonly days: (days: Array<string>) => void
        readonly start: (value: string) => void
        readonly end: (value: string) => void
        readonly position: (id: string) => void
        readonly min: (value: number) => void
        readonly ideal: (value: number) => void
        readonly peak: (value: boolean) => void
        readonly add: () => void
        readonly remove: (id: string) => void
    }
}

/** Draws the coverage blocks by weekday and the form that adds blocks over several days. */
export const ShiftsDemandBase = (props: ShiftsDemandBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
            <Text size="sm" tone="muted">
                {props.props.hint}
            </Text>
            {props.props.hasBlocks ? (
                <div className={DAYS_CLASS_NAME}>
                    {props.props.groups.map((group) => (
                        <div key={group.id} className={STACK_CLASS_NAME}>
                            <Text size="xs" weight="semibold">
                                {group.label}
                            </Text>
                            <TagGroup
                                label={group.label}
                                size="sm"
                                items={group.blocks}
                                onRemove={(ids) => ids.forEach((id) => props.on.remove(id))}
                                removeLabel={(label) => `${props.props.removeLabel} ${label}`}
                                emptyContent={
                                    <Text size="xs" tone="muted">
                                        -
                                    </Text>
                                }
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <Text size="sm" tone="muted">
                    {props.props.emptyLabel}
                </Text>
            )}
            <SectionHeader level={3} title={props.props.addTitle} />
            <CheckboxGroup
                label={props.props.labels.days}
                orientation="horizontal"
                options={props.props.dayOptions}
                value={props.props.form.days}
                onValueChange={props.on.days}
            />
            {renderDemandFields({ props })}
            <div className={ROW_CLASS_NAME}>
                <Switch
                    label={props.props.labels.peak}
                    name="peak"
                    isSelected={props.props.form.peak}
                    onSelectedChange={props.on.peak}
                />
                <Button
                    intent="commit"
                    isPending={props.props.isBusy}
                    isDisabled={!props.props.canAdd}
                    onPress={props.on.add}
                >
                    {props.props.addLabel}
                </Button>
            </div>
        </div>
    </SurfaceCard>
)

const renderDemandFields = ({ props }: RenderDemandFieldsInput) => (
    <div className={FORM_GRID_CLASS_NAME}>
        <Select
            label={props.props.labels.from}
            name="cstart"
            value={props.props.form.start}
            options={props.props.timeOptions}
            onValueChange={(value) => {
                if (value !== null) props.on.start(value)
            }}
        />
        <Select
            label={props.props.labels.to}
            name="cend"
            value={props.props.form.end}
            options={props.props.timeOptions}
            onValueChange={(value) => {
                if (value !== null) props.on.end(value)
            }}
        />
        <Select
            label={props.props.labels.position}
            name="cpos"
            value={props.props.form.positionId}
            options={props.props.positionOptions}
            onValueChange={(value) => {
                if (value !== null) props.on.position(value)
            }}
        />
        <NumberField
            label={props.props.labels.min}
            name="cmin"
            value={props.props.form.min}
            minValue={0}
            maxValue={50}
            onValueChange={props.on.min}
        />
        <NumberField
            label={props.props.labels.ideal}
            name="cideal"
            value={props.props.form.ideal}
            minValue={props.props.form.min}
            maxValue={50}
            onValueChange={props.on.ideal}
        />
    </div>
)

type RenderDemandFieldsInput = { props: ShiftsDemandBaseProps }
