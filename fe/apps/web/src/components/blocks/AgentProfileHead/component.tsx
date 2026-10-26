import {
    Badge,
    Breadcrumbs,
    Button,
    NumberField,
    SectionHeader,
    Select,
    SurfaceCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import {
    ACTION_CLASS,
    CHIPS_CLASS,
    COMPOSER_CLASS,
    COMPOSER_FOOT_CLASS,
    HEAD_CLASS,
    IDENTITY_CLASS,
    TASK_CLASS,
} from "./classNames"

/** Copy and state of the heading of an agent profile. */
export interface AgentProfileHeadBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly eyebrow: string
        readonly title: string
        /** The @handle and the module the agent works for. */
        readonly description: string
        /** The agent id: the generated avatar of an agent without a picture. */
        readonly seed: string
        /** The picture the owner gave the agent, or null. */
        readonly picture: string | null
        readonly chips: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: BadgeTone }>
        readonly isLoading: boolean
        readonly assignLabel: string
        /** False while the agent is paused: nobody can hand it work. */
        readonly canAssign: boolean
        readonly composer: {
            readonly isOpen: boolean
            readonly title: string
            readonly mention: string
            readonly label: string
            readonly placeholder: string
            readonly hint: string
            readonly sendLabel: string
            readonly text: string
            readonly maxLength: number
            readonly canSend: boolean
            readonly isPending: boolean
            readonly taskLabel: string
            /** The actions the agent's rules cover, after the choice that hands no structured work. */
            readonly tasks: ReadonlyArray<{ readonly id: string; readonly label: string }>
            readonly task: string
            /** True once an action is chosen: the amount, the deal value and the customer then show. */
            readonly hasTask: boolean
            readonly amountLabel: string
            readonly amount: number
            readonly valueLabel: string
            readonly value: number
            readonly leadLabel: string
            readonly leads: ReadonlyArray<{ readonly id: string; readonly label: string }>
            readonly lead: string
        }
    }
    readonly on: {
        readonly toggle: () => void
        readonly change: (text: string) => void
        readonly send: () => void
        readonly task: (action: string | null) => void
        readonly amount: (amount: number) => void
        readonly value: (amountVnd: number) => void
        readonly lead: (leadId: string | null) => void
    }
}

/** The structured work of the request: the action, its amount, the deal value and the customer. */
const TaskFields = (props: AgentProfileHeadBaseProps) => {
    const view = props.props.composer
    return (
        <div className={TASK_CLASS}>
            <Select
                label={view.taskLabel}
                options={view.tasks}
                value={view.task}
                isDisabled={view.isPending}
                onValueChange={props.on.task}
            />
            {view.hasTask ? (
                <>
                    <NumberField
                        label={view.amountLabel}
                        minValue={0}
                        value={view.amount}
                        isDisabled={view.isPending}
                        onValueChange={props.on.amount}
                    />
                    <NumberField
                        label={view.valueLabel}
                        minValue={0}
                        step={1_000}
                        value={view.value}
                        isDisabled={view.isPending}
                        onValueChange={props.on.value}
                    />
                    <Select
                        label={view.leadLabel}
                        options={view.leads}
                        value={view.lead}
                        isDisabled={view.isPending}
                        onValueChange={props.on.lead}
                    />
                </>
            ) : null}
        </div>
    )
}

/** Draws the agent profile heading: trail, name and role, the identity chips, the "Giao viec" action and its mini composer. */
export const AgentProfileHeadBase = (props: AgentProfileHeadBaseProps) => {
    const view = props.props
    return (
        <div className={HEAD_CLASS}>
            <Breadcrumbs label={view.crumbLabel} items={view.crumbs} />
            <SectionHeader level={1} eyebrow={view.eyebrow} title={view.title} description={view.description} />
            <div className={IDENTITY_CLASS}>
                <AgentMark label={view.title} seed={view.seed} src={view.picture} size="lg" />
                <div className={CHIPS_CLASS}>
                    {view.chips.map((chip) => (
                        <Badge key={chip.id} tone={chip.tone}>
                            {chip.label}
                        </Badge>
                    ))}
                </div>
                <div className={ACTION_CLASS}>
                    <Button
                        intent="alternative"
                        isSkeleton={view.isLoading}
                        isDisabled={!view.canAssign}
                        onPress={props.on.toggle}
                    >
                        {view.assignLabel}
                    </Button>
                </div>
            </div>
            {view.composer.isOpen ? (
                <SurfaceCard label={view.composer.title} headingLevel={2}>
                    <div className={COMPOSER_CLASS}>
                        <Textarea
                            id="agent-assign-text"
                            name="text"
                            label={view.composer.label}
                            placeholder={view.composer.placeholder}
                            value={view.composer.text}
                            rows={3}
                            maxLength={view.composer.maxLength}
                            isDisabled={view.composer.isPending}
                            onValueChange={props.on.change}
                            onSubmitShortcut={props.on.send}
                        />
                        <TaskFields {...props} />
                        <div className={COMPOSER_FOOT_CLASS}>
                            <Badge tone="accent">{view.composer.mention}</Badge>
                            <Text size="sm" tone="muted">
                                {view.composer.hint}
                            </Text>
                            <Button
                                intent="commit"
                                isPending={view.composer.isPending}
                                isDisabled={!view.composer.canSend}
                                onPress={props.on.send}
                            >
                                {view.composer.sendLabel}
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>
            ) : null}
        </div>
    )
}
