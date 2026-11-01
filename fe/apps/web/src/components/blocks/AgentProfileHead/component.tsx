import {
    Badge,
    Button,
    Cluster,
    Grid,
    NumberField,
    Page,
    Select,
    Stack,
    SurfaceCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AgentMark } from "@/components/leaves/AgentMark"

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
    /** The page body, drawn under the composer. */
    readonly shape: { readonly body: ReactNode }
    readonly props: {
        readonly crumbLabel: string
        readonly assignLabel: string
        /** The heading once the agent arrived, or the placeholder while it has not. */
        readonly head: ProfileHeadView
        /** True while the agent is unresolved: the heading draws its measured placeholders. */
        readonly isSkeleton: boolean
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
        readonly toggle: () => void
        readonly change: (text: string) => void
        readonly send: () => void
        readonly task: (action: string | null) => void
        readonly amount: (amount: number) => void
        readonly value: (amountVnd: number) => void
        readonly lead: (leadId: string | null) => void
    }
}
/** What the composer and its task fields read: the copy and the commands, not the page body. */
type ComposerProps = Pick<AgentProfileHeadBaseProps, "props" | "on">

/** The structured work of the request: the action, its amount, the deal value and the customer. */
const TaskFields = (props: ComposerProps) => {
    const view = props.props.composer
    return (
        <Grid kind="form" columns={2}>
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
        </Grid>
    )
}

/** Draws the mini composer that hands the agent work, at the top of the page body while it is open. */
const AssignComposer = (props: ComposerProps) => {
    const { composer, head } = props.props
    return (
        <SurfaceCard label={head.composerTitle} headingLevel={2}>
            <Stack gap="row">
                <Textarea
                    id="agent-assign-text"
                    name="text"
                    label={composer.label}
                    placeholder={composer.placeholder}
                    value={composer.text}
                    rows={3}
                    maxLength={composer.maxLength}
                    isDisabled={composer.isPending}
                    onValueChange={props.on.change}
                    onSubmitShortcut={props.on.send}
                />
                <TaskFields {...props} />
                <Cluster gap="row" justify="between">
                    <Badge tone="accent">{head.mention}</Badge>
                    <Text size="sm" tone="muted">
                        {composer.hint}
                    </Text>
                    <Button
                        intent="commit"
                        isPending={composer.isPending}
                        isDisabled={!composer.canSend}
                        onPress={props.on.send}
                    >
                        {composer.sendLabel}
                    </Button>
                </Cluster>
            </Stack>
        </SurfaceCard>
    )
}

/** Draws the agent profile as one Page: trail, name and role, the identity chips and the "Giao viec" action in its header; the mini composer and the page body inside it. */
export const AgentProfileHeadBase = (props: AgentProfileHeadBaseProps) => {
    const view = props.props
    const { head, isSkeleton } = view
    return (
        <Page
            measure="product"
            isSkeleton={isSkeleton}
            header={{
                breadcrumbs: { label: view.crumbLabel, items: head.crumbs },
                title: head.title,
                description: head.description,
                mark: (
                    <AgentMark
                        label={head.title}
                        seed={head.seed}
                        src={head.picture}
                        size="lg"
                        isSkeleton={isSkeleton}
                    />
                ),
                status: head.chips.map((chip) => (
                    <Badge key={chip.id} tone={chip.tone} isSkeleton={isSkeleton}>
                        {chip.label}
                    </Badge>
                )),
                actions: (
                    <Button
                        intent="alternative"
                        isSkeleton={isSkeleton}
                        isDisabled={!head.canAssign}
                        onPress={props.on.toggle}
                    >
                        {view.assignLabel}
                    </Button>
                ),
            }}
        >
            <Stack gap="region">
                {view.composer.isOpen ? <AssignComposer {...props} /> : null}
                {props.shape.body}
            </Stack>
        </Page>
    )
}
