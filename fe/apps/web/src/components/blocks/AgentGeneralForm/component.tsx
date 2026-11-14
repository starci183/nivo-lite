import { Button, Form, Grid, Input, PinnedActionBar, Stack, Switch, Text } from "@starci/grammar/common"
import { FieldBlock } from "@/components/frames/FieldBlock"
import { WorkingHoursList, type WorkingHoursListProps } from "@/components/composites/WorkingHoursList"

/** The two fields of the reply limits of a chatbot. */
export interface ReplyLimitsView {
    readonly title: string
    readonly description: string
    readonly holdingLabel: string
    readonly holdingPlaceholder: string
    readonly holding: string
}

/** Copy and state of the general form: the fields that save together under one save button. */
export interface AgentGeneralFormBaseProps {
    readonly props: {
        readonly formLabel: string
        readonly nameLabel: string
        readonly name: string
        readonly aliasLabel: string
        readonly alias: string
        readonly afterHoursTitle: string
        readonly afterHoursDescription: string
        readonly afterHours: boolean
        readonly hours: Omit<WorkingHoursListProps, "on" | "isDisabled">
        /** Null leaves the reply limits out (every type but the chatbot). */
        readonly reply: ReplyLimitsView | null
        readonly isDisabled: boolean
        readonly isPending: boolean
        readonly isDirty: boolean
        readonly canSave: boolean
        readonly dirtyLabel: string
        readonly cancelLabel: string
        readonly saveLabel: string
    }
    readonly on: {
        readonly name: (value: string) => void
        readonly afterHours: (on: boolean) => void
        readonly addRange: (days: ReadonlyArray<number>) => void
        readonly removeRange: (days: ReadonlyArray<number>, at: number) => void
        readonly editRange: (days: ReadonlyArray<number>, at: number, side: "start" | "end", clock: string) => void
        readonly splitRange: (days: ReadonlyArray<number>) => void
        readonly holding: (value: string) => void
        readonly cancel: () => void
        readonly save: () => void
    }
}

type Props = AgentGeneralFormBaseProps["props"]
type On = AgentGeneralFormBaseProps["on"]

/** What the name fields read. */
interface InfoPart {
    readonly props: Pick<Props, "nameLabel" | "name" | "aliasLabel" | "alias" | "isDisabled">
    readonly on: Pick<On, "name">
}

/** What the working hours list reads. */
interface HoursPart {
    readonly props: Pick<Props, "hours" | "isDisabled">
    readonly on: Pick<On, "addRange" | "removeRange" | "editRange" | "splitRange">
}

/** What the reply limits read. */
interface ReplyPart {
    readonly reply: ReplyLimitsView
    readonly isDisabled: boolean
    readonly on: Pick<On, "holding">
}

/** What the footer reads. */
interface FooterPart {
    readonly props: Pick<Props, "formLabel" | "isDirty" | "isPending" | "canSave" | "dirtyLabel" | "cancelLabel" | "saveLabel">
}

const InfoFields = (part: InfoPart) => (
    <Grid kind="form" columns={2}>
        <Input
            id="agent-name"
            name="name"
            label={part.props.nameLabel}
            value={part.props.name}
            isDisabled={part.props.isDisabled}
            onValueChange={part.on.name}
        />
        <Input id="agent-alias" name="alias" label={part.props.aliasLabel} value={part.props.alias} isReadOnly />
    </Grid>
)

const HoursBoard = (part: HoursPart) => (
    <WorkingHoursList
        {...part.props.hours}
        isDisabled={part.props.isDisabled}
        on={{ add: part.on.addRange, remove: part.on.removeRange, edit: part.on.editRange, split: part.on.splitRange }}
    />
)

const ReplyFields = (part: ReplyPart) => (
    <FieldBlock title={part.reply.title} description={part.reply.description}>
        <Grid kind="form" columns={2}>
            <Input
                id="holding-message"
                name="holding-message"
                label={part.reply.holdingLabel}
                placeholder={part.reply.holdingPlaceholder}
                value={part.reply.holding}
                isDisabled={part.isDisabled}
                onValueChange={part.on.holding}
            />
        </Grid>
    </FieldBlock>
)

const FooterBar = (part: FooterPart) => (
    <PinnedActionBar
        label={part.props.formLabel}
        visibility="always"
        summary={
            part.props.isDirty ? (
                <Text size="xs" tone="muted">
                    {part.props.dirtyLabel}
                </Text>
            ) : null
        }
        dismiss={
            <Button intent="dismiss" type="reset" isDisabled={!part.props.isDirty || part.props.isPending}>
                {part.props.cancelLabel}
            </Button>
        }
        commit={
            <Button intent="commit" type="submit" isPending={part.props.isPending} isDisabled={!part.props.canSave}>
                {part.props.saveLabel}
            </Button>
        }
    />
)

/**
 * Draws the general section of Setup as one form of flat fields on the page ground: the name fields, the working hours list, the
 * after-hours switch (a title with its switch at the right) and (for a chatbot) the reply limits; then ONE footer with a cancel and the one
 * primary save, pinned to the bottom edge of the pane and lit only while something changed.
 */
export const AgentGeneralFormBase = (props: AgentGeneralFormBaseProps) => (
    <Form
        label={props.props.formLabel}
        onSubmit={(_, event) => {
            event.preventDefault()
            props.on.save()
        }}
        onReset={props.on.cancel}
        isPending={props.props.isPending}
    >
        <Stack gap="row">
            <InfoFields props={props.props} on={props.on} />
            <HoursBoard props={props.props} on={props.on} />
            <FieldBlock
                title={props.props.afterHoursTitle}
                description={props.props.afterHoursDescription}
                trailing={
                    <Switch
                        name="after-hours"
                        label={props.props.afterHoursTitle}
                        isLabelHidden
                        isSelected={props.props.afterHours}
                        isDisabled={props.props.isDisabled}
                        onSelectedChange={props.on.afterHours}
                    />
                }
            />
            {props.props.reply === null ? null : (
                <ReplyFields reply={props.props.reply} isDisabled={props.props.isDisabled} on={props.on} />
            )}
            <FooterBar props={props.props} />
        </Stack>
    </Form>
)
