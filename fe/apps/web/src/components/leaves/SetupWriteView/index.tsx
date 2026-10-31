import {
    Alert,
    Badge,
    Button,
    Cluster,
    DescriptionList,
    Input,
    NumberField,
    RadioGroup,
    SegmentedControl,
    Stack,
    SurfaceCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import type { SetupWriteDecided, SetupWriteProposal } from "@/modules/types"

/** The commands of a card. */
interface SetupWriteViewCommands {
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

/** One card of the setup chat, decided or waiting, with the commands that change it. */
interface SetupWriteViewProps {
    readonly props: { readonly decided: SetupWriteDecided | null; readonly proposal: SetupWriteProposal }
    readonly on: SetupWriteViewCommands
}

const FactFields = (props: SetupWriteViewProps) => (
    <>
        <Textarea
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

const RuleFields = (props: SetupWriteViewProps) => (
    <>
        <SegmentedControl
            label={props.props.proposal.modeLabel}
            value={props.props.proposal.mode}
            onValueChange={props.on.mode}
            options={props.props.proposal.modeOptions}
        />
        {props.props.proposal.hasLimit ? (
            <NumberField
                label={props.props.proposal.limitLabel}
                minValue={0}
                step={1_000_000}
                formatOptions={{ maximumFractionDigits: 0 }}
                isDisabled={props.props.proposal.isLimitDisabled}
                {...(props.props.proposal.limit !== undefined && { value: props.props.proposal.limit })}
                onValueChange={props.on.limit}
            />
        ) : null}
    </>
)

/** Draws one proposed write of the setup chat. A decided card is one line; a waiting card shows what would be written and lets the owner confirm, edit or dismiss it. */
export const SetupWriteView = (props: SetupWriteViewProps) => {
    const { decided, proposal } = props.props
    if (decided !== null) {
        return (
            <SurfaceCard ariaLabel={decided.line}>
                <Stack gap="inline">
                    <Cluster gap="inline" justify="between">
                        <Text size="sm" tone="muted">
                            {decided.line}
                        </Text>
                        <Badge isDot tone={decided.tone}>
                            {decided.label}
                        </Badge>
                    </Cluster>
                </Stack>
            </SurfaceCard>
        )
    }
    return (
        <SurfaceCard ariaLabel={proposal.head}>
            <Stack gap="inline">
                <Cluster gap="inline" justify="between">
                    <Text weight="semibold" size="sm">
                        {proposal.head}
                    </Text>
                    {proposal.hasGap ? <Badge tone="warning">{proposal.gapLabel}</Badge> : null}
                </Cluster>
                <DescriptionList layout="stacked" items={proposal.items} />
                {proposal.sharedNote === "" ? null : (
                    <Text size="xs" tone="muted">
                        {proposal.sharedNote}
                    </Text>
                )}
                {proposal.isEditing ? (
                    <Stack gap="row">{proposal.isFact ? <FactFields {...props} /> : <RuleFields {...props} />}</Stack>
                ) : null}
                {proposal.isConflict ? (
                    <Stack gap="row">
                        <Alert tone="cautionary" title={proposal.conflictTitle} description={proposal.conflictBody} />
                        <RadioGroup
                            label={proposal.conflictTitle}
                            isLabelHidden
                            value={proposal.resolution}
                            onValueChange={props.on.resolution}
                            options={proposal.resolutionOptions}
                        />
                        {proposal.resolution === "both" ? (
                            <Input
                                id={`write-${proposal.id}-situation`}
                                name="situation"
                                label={proposal.situationLabel}
                                value={proposal.situation}
                                onValueChange={props.on.situation}
                            />
                        ) : null}
                    </Stack>
                ) : null}
                <Cluster gap="inline">
                    <Button
                        intent="commit"
                        size="sm"
                        isPending={proposal.isPending}
                        isDisabled={!proposal.canConfirm}
                        onPress={props.on.confirm}
                    >
                        {proposal.confirmLabel}
                    </Button>
                    <Button intent="neutral" size="sm" isDisabled={proposal.isPending} onPress={props.on.toggleEdit}>
                        {proposal.editLabel}
                    </Button>
                    <Button intent="alternative" size="sm" isDisabled={proposal.isPending} onPress={props.on.reject}>
                        {proposal.rejectLabel}
                    </Button>
                </Cluster>
            </Stack>
        </SurfaceCard>
    )
}
