import {
    Alert,
    Badge,
    Button,
    DescriptionList,
    Input,
    NumberField,
    RadioGroup,
    SegmentedControl,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { ACTIONS, WRITE, WRITE_FIELDS, WRITE_HEAD } from "./classNames"

type Option = { readonly value: string; readonly label: string }

/** The facts of a card that was already decided: one line and how it ended. */
export interface SetupWriteDecided {
    readonly line: string
    readonly label: string
    readonly tone: "success" | "neutral"
}

/** The facts and fields of a card that waits for the owner. */
export interface SetupWriteProposal {
    readonly id: string
    readonly head: string
    readonly isFact: boolean
    readonly hasGap: boolean
    readonly gapLabel: string
    readonly items: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
    readonly sharedNote: string
    readonly isEditing: boolean
    readonly valueLabel: string
    readonly value: string
    readonly scopeLabel: string
    readonly scope: string
    readonly scopeOptions: ReadonlyArray<Option>
    readonly forLabel: string
    readonly forValue: string
    readonly forOptions: ReadonlyArray<Option>
    readonly modeLabel: string
    readonly mode: string
    readonly modeOptions: ReadonlyArray<Option>
    readonly hasLimit: boolean
    readonly limitLabel: string
    readonly limit: number | undefined
    readonly isLimitDisabled: boolean
    readonly isConflict: boolean
    readonly conflictTitle: string
    readonly conflictBody: string
    readonly resolution: string
    readonly resolutionOptions: ReadonlyArray<Option>
    readonly situationLabel: string
    readonly situation: string
    readonly errorTitle: string
    readonly error: string
    readonly confirmLabel: string
    readonly editLabel: string
    readonly rejectLabel: string
    readonly canConfirm: boolean
    readonly isPending: boolean
}

/** One card of the setup chat, decided or waiting, with the commands that change it. */
export interface SetupWriteCardBaseProps {
    readonly props: { readonly decided: SetupWriteDecided | null; readonly proposal: SetupWriteProposal }
    readonly on: {
        readonly value: (value: string) => void
        readonly scope: (value: string) => void
        readonly forWho: (value: string) => void
        readonly mode: (value: string) => void
        readonly limit: (value: number) => void
        readonly resolution: (value: string) => void
        readonly situation: (value: string) => void
        readonly confirm: () => void
        readonly toggleEdit: () => void
        readonly reject: () => void
    }
}

const FactFields = (props: SetupWriteCardBaseProps) => (
    <>
        <Textarea
            variant="secondary"
            name={`write-${props.props.proposal.id}-value`}
            label={props.props.proposal.valueLabel}
            rows={2}
            maxLength={2000}
            value={props.props.proposal.value}
            onValueChange={props.on.value}
        />
        <SegmentedControl
            label={props.props.proposal.scopeLabel}
            value={props.props.proposal.scope}
            onValueChange={props.on.scope}
            options={props.props.proposal.scopeOptions}
        />
        {props.props.proposal.forOptions.length === 0 ? null : (
            <SegmentedControl
                label={props.props.proposal.forLabel}
                value={props.props.proposal.forValue}
                onValueChange={props.on.forWho}
                options={props.props.proposal.forOptions}
            />
        )}
    </>
)

const RuleFields = (props: SetupWriteCardBaseProps) => (
    <>
        <SegmentedControl
            label={props.props.proposal.modeLabel}
            value={props.props.proposal.mode}
            onValueChange={props.on.mode}
            options={props.props.proposal.modeOptions}
        />
        {props.props.proposal.hasLimit ? (
            <NumberField
                variant="secondary"
                label={props.props.proposal.limitLabel}
                minValue={0}
                step={1_000_000}
                formatOptions={{ maximumFractionDigits: 0 }}
                isDisabled={props.props.proposal.isLimitDisabled}
                value={props.props.proposal.limit}
                onValueChange={props.on.limit}
            />
        ) : null}
    </>
)

/** Draws one proposed write of the setup chat. A decided card is one line; a waiting card shows what would be written and lets the owner confirm, edit or dismiss it. */
export const SetupWriteCardBase = (props: SetupWriteCardBaseProps) => {
    const { decided, proposal } = props.props
    if (decided !== null) {
        return (
            <div className={WRITE}>
                <div className={WRITE_HEAD}>
                    <Text size="sm" tone="muted">
                        {decided.line}
                    </Text>
                    <Badge isDot tone={decided.tone}>
                        {decided.label}
                    </Badge>
                </div>
            </div>
        )
    }
    return (
        <div className={WRITE}>
            <div className={WRITE_HEAD}>
                <Text weight="semibold" size="sm">
                    {proposal.head}
                </Text>
                {proposal.hasGap ? <Badge tone="warning">{proposal.gapLabel}</Badge> : null}
            </div>
            <DescriptionList layout="stacked" items={proposal.items} />
            {proposal.sharedNote === "" ? null : (
                <Text size="xs" tone="muted">
                    {proposal.sharedNote}
                </Text>
            )}
            {proposal.isEditing ? (
                <div className={WRITE_FIELDS}>
                    {proposal.isFact ? <FactFields {...props} /> : <RuleFields {...props} />}
                </div>
            ) : null}
            {proposal.isConflict ? (
                <div className={WRITE_FIELDS}>
                    <Alert tone="cautionary" title={proposal.conflictTitle} description={proposal.conflictBody} />
                    <RadioGroup
                        label={proposal.conflictTitle}
                        isLabelHidden
                        variant="secondary"
                        value={proposal.resolution}
                        onValueChange={props.on.resolution}
                        options={proposal.resolutionOptions}
                    />
                    {proposal.resolution === "both" ? (
                        <Input
                            id={`write-${proposal.id}-situation`}
                            name="situation"
                            variant="secondary"
                            label={proposal.situationLabel}
                            value={proposal.situation}
                            onValueChange={props.on.situation}
                        />
                    ) : null}
                </div>
            ) : null}
            {proposal.error === "" ? null : (
                <Alert tone="negative" title={proposal.errorTitle} description={proposal.error} />
            )}
            <div className={ACTIONS}>
                <Button
                    variant="primary"
                    size="sm"
                    isPending={proposal.isPending}
                    isDisabled={!proposal.canConfirm}
                    onPress={props.on.confirm}
                >
                    {proposal.confirmLabel}
                </Button>
                <Button variant="ghost" size="sm" isDisabled={proposal.isPending} onPress={props.on.toggleEdit}>
                    {proposal.editLabel}
                </Button>
                <Button variant="ghost" size="sm" isDisabled={proposal.isPending} onPress={props.on.reject}>
                    {proposal.rejectLabel}
                </Button>
            </div>
        </div>
    )
}
