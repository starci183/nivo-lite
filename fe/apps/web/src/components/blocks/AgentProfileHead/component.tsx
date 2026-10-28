import {
    Badge,
    Button,
    NumberField,
    PageContainer,
    PageHeader,
    Select,
    SurfaceCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { AgentMark } from "@/components/leaves/AgentMark"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { COMPOSER_CLASS, COMPOSER_FOOT_CLASS, COMPOSER_PAGE_CLASS, TASK_CLASS } from "./classNames"

/** What the heading shows once the agent arrived, every word resolved. */
export interface ProfileHeadView {
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    readonly title: string
    /** The @handle and the module the agent works for. */
    readonly description: string
    /** The agent id: the generated avatar of an agent without a picture. */
    readonly seed: string
    /** The picture the owner gave the agent, or null. */
    readonly picture: string | null
    readonly chips: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: BadgeTone }>
    /** False while the agent is paused: nobody can hand it work. */
    readonly canAssign: boolean
    readonly composerTitle: string
    readonly mention: string
}

/** Copy and slot of the heading of an agent profile. */
export interface AgentProfileHeadBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly assignLabel: string
        readonly slot: DataSlot<ProfileHeadView>
        readonly placeholder: ProfileHeadView
        readonly slotLabels: SlotLabels
        readonly composer: {
            readonly isOpen: boolean
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
        readonly retry: () => void
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
        <SlotView slot={view.slot} placeholder={view.placeholder} labels={view.slotLabels} onRetry={props.on.retry}>
            {(head, isSkeleton) => (
                <>
                    <PageHeader
                        measure="product"
                        isSkeleton={isSkeleton}
                        breadcrumbs={{ label: view.crumbLabel, items: head.crumbs }}
                        title={head.title}
                        description={head.description}
                        mark={
                            <AgentMark
                                label={head.title}
                                seed={head.seed}
                                src={head.picture}
                                size="lg"
                                isSkeleton={isSkeleton}
                            />
                        }
                        status={head.chips.map((chip) => (
                            <Badge key={chip.id} tone={chip.tone} isSkeleton={isSkeleton}>
                                {chip.label}
                            </Badge>
                        ))}
                        actions={
                            <Button
                                intent="alternative"
                                isSkeleton={isSkeleton}
                                isDisabled={!head.canAssign}
                                onPress={props.on.toggle}
                            >
                                {view.assignLabel}
                            </Button>
                        }
                    />
                    {view.composer.isOpen ? (
                        <PageContainer measure="product" className={COMPOSER_PAGE_CLASS}>
                            <SurfaceCard label={head.composerTitle} headingLevel={2}>
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
                                        <Badge tone="accent">{head.mention}</Badge>
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
                        </PageContainer>
                    ) : null}
                </>
            )}
        </SlotView>
    )
}
