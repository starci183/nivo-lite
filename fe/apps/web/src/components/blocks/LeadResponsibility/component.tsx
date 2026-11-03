import type * as React from "react"
import type { DateValue } from "@internationalized/date"
import {
    Alert,
    Badge,
    Button,
    Cluster,
    DescriptionList,
    EmptyNotice,
    Section,
    Stack,
    SurfaceCard,
    Text,
    type BadgeTone,
} from "@starci/grammar/common"

import { SlotView } from "@nivo-lite/agent-sdk/client"
import { StepForm, type StepFormLabels } from "@/components/composites/StepForm"

import { AgentMark } from "@/components/leaves/AgentMark"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"

import type { DataSlot, ModuleIconName, SlotLabels, StepFormView } from "@/modules/types"
import { PANEL_CLASS_NAME } from "./classNames"

/** The words of the panel. */
export interface ResponsibilityLabels {
    readonly cardLabel: string
    readonly nextStepLabel: string
    readonly accountableLabel: string
    readonly dueLabel: string
    readonly noDueLabel: string
    readonly overdueLabel: string
    readonly noOwnerTitle: string
    readonly noOwnerHint: string
    readonly proposeLabel: string
    readonly proposeFailTitle: string
    readonly reassignLabel: string
    readonly changeDueLabel: string
    readonly askLabel: string
    readonly askHref: string
    readonly addLabel: string
    readonly form: StepFormLabels
    readonly slot: SlotLabels
}

/** The step being worked on, every word already resolved. */
export interface StepView {
    readonly title: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly nextAction: string
    readonly ownerName: string
    readonly ownerKindText: string
    readonly due: { readonly date: string; readonly relative: string; readonly isOverdue: boolean } | null
    readonly isDone: boolean
    readonly isAgent: boolean
    /** The semantic Icon name used when the owner is an agent. */
    readonly agentGlyph: ModuleIconName
    /** The picture the owner gave the agent owner; null draws the NIVO unicorn mascot. */
    readonly agentAvatarUrl: string | null
}

/** What the panel shows about one lead: its current step, or none yet. */
export interface ResponsibilityView {
    readonly current: StepView | null
}

/** The words and state of the responsibility panel. */
export interface LeadResponsibilityBaseProps {
    readonly props: {
        readonly slot: DataSlot<ResponsibilityView>
        readonly labels: ResponsibilityLabels
        readonly form: StepFormView | null
        readonly proposeError: string | null
        readonly isPending: boolean
    }
    readonly on: {
        readonly propose: () => void
        readonly open: (mode: "reassign" | "add" | "due") => void
        readonly close: () => void
        readonly change: (field: "title" | "owner" | "nextAction", value: string) => void
        readonly changeDue: (value: DateValue | null) => void
        readonly submit: () => void
    }
}

const PLACEHOLDER: ResponsibilityView = {
    current: {
        title: "",
        statusLabel: "",
        statusTone: "neutral",
        nextAction: "",
        ownerName: "",
        ownerKindText: "",
        due: null,
        isDone: false,
        isAgent: false,
        agentGlyph: "moduleChatbot",
        agentAvatarUrl: null,
    },
}

/** The responsibility panel: the current step with its owner and due date, and the actions on it. */
export const LeadResponsibilityBase = (props: LeadResponsibilityBaseProps) => {
    const { props: p, on } = props
    const l = p.labels
    const formActions = { change: on.change, changeDue: on.changeDue, submit: on.submit, close: on.close }
    return (
        <div id="responsibility" className={PANEL_CLASS_NAME}>
            <Stack gap="section">
                <SurfaceCard label={l.cardLabel} headingLevel={2}>
                    <SlotView
                        slot={p.slot}
                        placeholder={PLACEHOLDER}
                        labels={l.slot}
                        render={(view, isLoading) => {
                            const current = view.current
                            const form =
                                p.form === null ? null : (
                                    <StepForm form={p.form} labels={l.form} isPending={p.isPending} on={formActions} />
                                )
                            if (current === null) {
                                return (
                                    <>
                                        {form ?? (
                                            <EmptyNotice
                                                message={l.noOwnerTitle}
                                                description={l.noOwnerHint}
                                                actionLabel={l.proposeLabel}
                                                isActionPending={p.isPending}
                                                onAction={on.propose}
                                            />
                                        )}
                                        {p.proposeError === null ? null : (
                                            <Alert
                                                title={l.proposeFailTitle}
                                                description={p.proposeError}
                                                tone="negative"
                                            />
                                        )}
                                    </>
                                )
                            }
                            return renderCurrentStep({ isLoading, current, l, form, on })
                        }}
                    />
                </SurfaceCard>
            </Stack>
        </div>
    )
}

/** Inputs needed to build the accountableLabel section. */
interface RenderStepOwnerContext {
    readonly l: ResponsibilityLabels
    readonly current: StepView
    readonly isLoading: boolean
}
/** Builds the accountableLabel section from the current view. */
const renderStepOwner = ({ l, current, isLoading }: RenderStepOwnerContext) => (
    <Section title={l.accountableLabel} headingLevel={3} isLoading={isLoading}>
        <Cluster gap="section" justify="between">
            <Cluster gap="row" wrap={false}>
                {current.isAgent ? (
                    <AgentMark
                        label={current.ownerName}
                        seed={current.ownerName}
                        src={current.agentAvatarUrl}

                        size="md"
                    />
                ) : (
                    <PersonAvatar name={current.ownerName} size="md" />
                )}
                <Stack gap="identity">
                    <Text isStrong isLoading={isLoading}>
                        {current.ownerName}
                    </Text>
                    <Text size="xs" tone="muted">
                        {current.ownerKindText}
                    </Text>
                </Stack>
            </Cluster>
            <DescriptionList
                layout="stacked"
                isLoading={isLoading}
                items={[
                    {
                        id: "due",
                        term: l.dueLabel,
                        description:
                            current.due === null ? (
                                <Text tone="muted">{l.noDueLabel}</Text>
                            ) : (
                                <Cluster gap="inline">
                                    <Text as="span" isStrong>
                                        {current.due.date}
                                    </Text>
                                    <Text as="span" size="sm" tone="muted">
                                        {current.due.relative}
                                    </Text>
                                    {current.due.isOverdue && !current.isDone ? (
                                        <Badge tone="danger">{l.overdueLabel}</Badge>
                                    ) : null}
                                </Cluster>
                            ),
                    },
                ]}
            />
        </Cluster>
    </Section>
)

/** Inputs needed to build the Body section. */
interface RenderCurrentStepContext {
    readonly isLoading: boolean
    readonly current: StepView
    readonly l: ResponsibilityLabels
    readonly form: React.JSX.Element | null
    readonly on: LeadResponsibilityBaseProps["on"]
}
/** Builds the Body section from the current view. */
const renderCurrentStep = ({ isLoading, current, l, form, on }: RenderCurrentStepContext) => (
    <Stack gap="region">
        <Cluster gap="row" justify="between">
            <Text size="sm" tone="muted" isLoading={isLoading}>
                {current.title}
            </Text>
            <Badge tone={current.statusTone}>{current.statusLabel}</Badge>
        </Cluster>
        <Section title={l.nextStepLabel} headingLevel={3} isLoading={isLoading}>
            <Text size="md" isStrong isLoading={isLoading}>
                {current.nextAction}
            </Text>
        </Section>
        {renderStepOwner({ l, current, isLoading })}
        {form}
        {form !== null ? null : (
            <Cluster gap="row">
                {current.isDone ? (
                    <Button intent="neutral" onPress={() => on.open("add")} isLoading={isLoading}>
                        {l.addLabel}
                    </Button>
                ) : (
                    <>
                        <Button intent="neutral" onPress={() => on.open("reassign")} isLoading={isLoading}>
                            {l.reassignLabel}
                        </Button>
                        <Button intent="neutral" onPress={() => on.open("due")} isLoading={isLoading}>
                            {l.changeDueLabel}
                        </Button>
                        {current.isAgent ? (
                            <Button intent="neutral" href={l.askHref} isLoading={isLoading}>
                                {l.askLabel}
                            </Button>
                        ) : null}
                    </>
                )}
            </Cluster>
        )}
    </Stack>
)
