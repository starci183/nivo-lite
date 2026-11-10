import { Badge, Button, Cluster, DropdownMenu, IconButton, Select, Stack, Stepper, SurfaceCard, Text } from "@starci/grammar/common"
import type { StepperStep } from "@starci/grammar/common"
import { ChannelAvatar } from "@/components/leaves/ChannelAvatar"
import { nivoIconSource } from "@/components/leaves/Icon"
import { ALL_OPTION } from "@/modules/inbox"
import type { InboxCopy } from "@/modules/inbox"
import {
    BELOW_WIDE_CLASS_NAME,
    COMMANDS_ROW_CLASS_NAME,
    IDENTITY_ROW_CLASS_NAME,
    IDENTITY_TEXT_CLASS_NAME,
    PHONE_ONLY_CLASS_NAME,
} from "./classNames"
import type { InboxDetailView, InboxOptionView } from "@/modules/types"

/** Props for {@link InboxLeadHead}. */
export interface InboxLeadHeadProps {
    readonly props: {
        readonly copy: InboxCopy
        /** The opened customer. */
        readonly detail: InboxDetailView
        /** The agents a customer can be handed to. */
        readonly agents: ReadonlyArray<InboxOptionView>
        /** The label of the control that returns a phone to the list. */
        readonly back: string
    }
    readonly on: {
        readonly assign: (leadId: string, agentId: string | null) => void
        readonly message: () => void
        readonly copyPhone: (phone: string) => void
        readonly back: () => void
        /** Opens the drawer of the customer's facts. */
        readonly openAside: () => void
    }
}

/** The stepper steps of the customer: every stage is a step, the stage the customer stands in is the current one. */
const stepsOf = (detail: InboxDetailView): ReadonlyArray<StepperStep> =>
    detail.steps.map((step) => ({ id: step.id, label: step.label }))

/** The control that hands the customer to an agent: a pill with the muted word "Assign to" before the agent. */
const AssignSelect = (props: InboxLeadHeadProps & { readonly detail: InboxDetailView }) => {
    const { copy, agents } = props.props
    return (
        <Select
            label={copy.assignLabel}
            isLabelHidden
            prefix={copy.assignLabel}
            appearance="pill"
            options={[{ id: ALL_OPTION, label: copy.assignNobody }, ...agents]}
            value={props.detail.agent?.id ?? ALL_OPTION}
            onValueChange={(id) => {
                if (id !== null) props.on.assign(props.detail.id, id === ALL_OPTION ? null : id)
            }}
        />
    )
}

/** The commands beyond the primary one: the menu of the head. */
const MoreMenu = (props: InboxLeadHeadProps & { readonly detail: InboxDetailView }) => {
    const { copy } = props.props
    const phone = props.detail.phone
    return (
        <DropdownMenu
            trigger={<IconButton intent="neutral" source={nivoIconSource("more", "leading")} label={copy.moreLabel} />}
            entries={
                phone === null
                    ? []
                    : [
                          {
                              id: "copy-phone",
                              label: copy.copyPhone,
                              iconSource: nivoIconSource("copy", "leading"),
                              onAction: () => props.on.copyPhone(phone),
                          },
                      ]
            }
        />
    )
}

/** The one primary command of the head: message the customer. A text-only commit button: a sm button takes no icon. */
const MessageButton = (props: InboxLeadHeadProps) => (
    <Button
        intent="commit"
        size="sm"
        onPress={props.on.message}
    >
        {props.props.copy.message}
    </Button>
)

/**
 * The head card of the opened customer, the first card of the well: the avatar, the name with the source line and the
 * menu, then the hand-over select and the one primary command (a phone adds the way back before them), over the stepper of the stage.
 * Below the wide width the facts are a drawer that an icon of the head opens.
 */
export const InboxLeadHead = (props: InboxLeadHeadProps) => {
    const { copy, detail, back } = props.props
    const own = { ...props, detail }
    return (
        <SurfaceCard ariaLabel={detail.name}>
            <Stack gap="row">
                <div className={IDENTITY_ROW_CLASS_NAME}>
                    <ChannelAvatar
                        name={detail.name}
                        seed={detail.id}
                        badge={detail.channelBadge}
                        channelLabel={detail.channelLabel}
                        size="lg"
                    />
                    <div className={IDENTITY_TEXT_CLASS_NAME}>
                        <Cluster gap="inline">
                            <Text isStrong>{detail.name}</Text>
                            <Badge tone={detail.stageChip.tone}>{detail.stageChip.label}</Badge>
                        </Cluster>
                        <Text size="sm" tone="muted">
                            {detail.sourceLine}
                        </Text>
                    </div>
                    <MoreMenu {...own} />
                    <div className={BELOW_WIDE_CLASS_NAME}>
                        <IconButton
                            intent="neutral"
                            source={nivoIconSource("profile", "leading")}
                            label={copy.openAside}
                            onPress={props.on.openAside}
                        />
                    </div>
                </div>
                <div className={COMMANDS_ROW_CLASS_NAME}>
                    <div className={PHONE_ONLY_CLASS_NAME}>
                        <IconButton
                            intent="neutral"
                            source={nivoIconSource("back", "leading")}
                            label={back}
                            onPress={props.on.back}
                        />
                    </div>
                    <div className={IDENTITY_TEXT_CLASS_NAME}>
                        <AssignSelect {...own} />
                    </div>
                    <MessageButton {...props} />
                </div>
                <Stepper label={copy.stepsLabel} steps={stepsOf(detail)} currentStepId={detail.currentStep} />
            </Stack>
        </SurfaceCard>
    )
}
