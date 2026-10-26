import { nivoIconSource } from "@/components/leaves/Icon"
import type { useTranslations } from "next-intl"
import type { useLeadActions, CurrentStepView } from "@/hooks/leads"
import type { useSlotLabels } from "@/hooks/slot"
import type { useLeadStepForm, LeadStepValues } from "@/hooks/rhf"

import type * as React from "react"
import type { DateValue } from "@internationalized/date"
import { Alert, Badge, Button, DescriptionList, EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"

import { SlotView } from "@/components/composites/SlotView"
import { StepForm, type StepFormLabels, type StepFormView } from "@/components/composites/StepForm"

import { AgentMark } from "@/components/leaves/AgentMark"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { DataSlot, SlotLabels } from "@/modules/types"
import {
    ACTIONS_CLASS_NAME,
    BODY_CLASS_NAME,
    DUE_CLASS_NAME,
    FOCAL_CLASS_NAME,
    OWNER_CLASS_NAME,
    OWNER_COPY_CLASS_NAME,
    OWNER_ROW_CLASS_NAME,
    PANEL_CLASS_NAME,
    TITLE_ROW_CLASS_NAME,
} from "./classNames"

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

/** What the panel shows about one lead: its current step, or none yet. */
export interface ResponsibilityView {
    readonly current: CurrentStepView | null
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
    },
}

/** The responsibility panel: the current step with its owner and due date, and the actions on it. */
export const LeadResponsibilityBase = (props: LeadResponsibilityBaseProps) => {
    const { props: p, on } = props
    const l = p.labels
    const formActions = { change: on.change, changeDue: on.changeDue, submit: on.submit, close: on.close }
    return (
        <div id="responsibility" className={PANEL_CLASS_NAME}>
            <SurfaceCard label={l.cardLabel} headingLevel={2}>
                <SlotView slot={p.slot} placeholder={PLACEHOLDER} labels={l.slot}>
                    {(view, isSkeleton) => {
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
                                            actionVariant="primary"
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
                        return renderCurrentStep({ isSkeleton, current, l, form, on })
                    }}
                </SlotView>
            </SurfaceCard>
        </div>
    )
}

/** Inputs needed to build the accountableLabel section. */
interface RenderStepOwnerContext {
    readonly l: ResponsibilityLabels
    readonly current: CurrentStepView
    readonly isSkeleton: boolean
}
/** Builds the accountableLabel section from the current view. */
const renderStepOwner = ({ l, current, isSkeleton }: RenderStepOwnerContext) => (
    <SurfaceCard ariaLabel={l.accountableLabel}>
        <div className={OWNER_ROW_CLASS_NAME}>
            <div className={OWNER_CLASS_NAME}>
                {current.isAgent ? (
                    <AgentMark
                        glyph={nivoIconSource(current.agentGlyph, "leading")}
                        label={current.ownerName}
                        module="chatbot"
                        size="md"
                    />
                ) : (
                    <PersonAvatar name={current.ownerName} size="md" />
                )}
                <div className={OWNER_COPY_CLASS_NAME}>
                    <Text weight="semibold" isSkeleton={isSkeleton}>
                        {current.ownerName}
                    </Text>
                    <Text size="xs" tone="muted">
                        {current.ownerKindText}
                    </Text>
                </div>
            </div>
            <DescriptionList
                layout="stacked"
                isLoading={isSkeleton}
                items={[
                    {
                        id: "due",
                        term: l.dueLabel,
                        description:
                            current.due === null ? (
                                <Text tone="muted">{l.noDueLabel}</Text>
                            ) : (
                                <div className={DUE_CLASS_NAME}>
                                    <Text as="span" weight="semibold">
                                        {current.due.date}
                                    </Text>
                                    <Text as="span" size="sm" tone="muted">
                                        {current.due.relative}
                                    </Text>
                                    {current.due.isOverdue && !current.isDone ? (
                                        <Badge tone="danger">{l.overdueLabel}</Badge>
                                    ) : null}
                                </div>
                            ),
                    },
                ]}
            />
        </div>
    </SurfaceCard>
)

/** Inputs needed to build the Body section. */
interface RenderCurrentStepContext {
    readonly isSkeleton: boolean
    readonly current: CurrentStepView
    readonly l: ResponsibilityLabels
    readonly form: React.JSX.Element | null
    readonly on: LeadResponsibilityBaseProps["on"]
}
/** Builds the Body section from the current view. */
const renderCurrentStep = ({ isSkeleton, current, l, form, on }: RenderCurrentStepContext) => (
    <div className={BODY_CLASS_NAME}>
        <div className={TITLE_ROW_CLASS_NAME}>
            <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                {current.title}
            </Text>
            <Badge tone={current.statusTone}>{current.statusLabel}</Badge>
        </div>
        <div className={FOCAL_CLASS_NAME}>
            <Text size="xs" tone="muted" weight="semibold">
                {l.nextStepLabel}
            </Text>
            <Text size="md" weight="semibold" isSkeleton={isSkeleton}>
                {current.nextAction}
            </Text>
        </div>
        {renderStepOwner({ l, current, isSkeleton })}
        {form}
        {isSkeleton || form !== null ? null : (
            <div className={ACTIONS_CLASS_NAME}>
                {current.isDone ? (
                    <Button intent="neutral" onPress={() => on.open("add")}>
                        {l.addLabel}
                    </Button>
                ) : (
                    <>
                        <Button intent="neutral" onPress={() => on.open("reassign")}>
                            {l.reassignLabel}
                        </Button>
                        <Button intent="neutral" onPress={() => on.open("due")}>
                            {l.changeDueLabel}
                        </Button>
                        {current.isAgent ? (
                            <Button intent="neutral" href={l.askHref}>
                                {l.askLabel}
                            </Button>
                        ) : null}
                    </>
                )}
            </div>
        )}
    </div>
)

/** The lead the panel acts on and the workspace it belongs to; a null detail draws the loading card. */
export interface LeadResponsibilityProps {
    readonly leadId?: string
}

/** The supported next-step editing action. */
export type Mode = "reassign" | "add" | "due"

/** Inputs needed to build the LeadResponsibilityContent section. */
export interface BuildResponsibilityPanelViewContext {
    readonly slot: DataSlot<ResponsibilityView>
    readonly form: StepFormView | null
    readonly proposeError: string | null
    readonly actions: ReturnType<typeof useLeadActions>
    readonly isPending: boolean
    readonly t: ReturnType<typeof useTranslations<"lead">>
    readonly slotLabels: ReturnType<typeof useSlotLabels>
}

/** Inputs needed to build the LeadResponsibilityContent section. */
export interface BuildStepFormViewContext {
    readonly mode: Mode
    readonly formLabels: Readonly<Record<Mode, string>>
    readonly fields: LeadStepValues
    readonly t: ReturnType<typeof useTranslations<"lead">>
    readonly agents: readonly import("@/modules/types").AgentRecord[]
    readonly submitLabels: Readonly<Record<Mode, string>>
    readonly error: string | null
    readonly rhf: ReturnType<typeof useLeadStepForm>
}

/** The form value representing a human owner. */
export const HUMAN = "human"
