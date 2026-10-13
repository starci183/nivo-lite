import type { DateValue } from "@internationalized/date"
import { Alert, Badge, Button, DescriptionList, EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"
import type { CurrentStepView } from "@/hooks/leads"
import { SlotView } from "@/components/composites/SlotView"
import { StepForm } from "@/components/composites/StepForm"
import type { StepFormLabels, StepFormView } from "@/components/composites/StepForm"
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
        agentGlyph: "",
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
                        return (
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
                                <SurfaceCard depth="nested" ariaLabel={l.accountableLabel}>
                                    <div className={OWNER_ROW_CLASS_NAME}>
                                        <div className={OWNER_CLASS_NAME}>
                                            {current.isAgent ? (
                                                <AgentMark
                                                    glyph={current.agentGlyph}
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
                                {form}
                                {isSkeleton || form !== null ? null : (
                                    <div className={ACTIONS_CLASS_NAME}>
                                        {current.isDone ? (
                                            <Button variant="outline" onPress={() => on.open("add")}>
                                                {l.addLabel}
                                            </Button>
                                        ) : (
                                            <>
                                                <Button variant="outline" onPress={() => on.open("reassign")}>
                                                    {l.reassignLabel}
                                                </Button>
                                                <Button variant="outline" onPress={() => on.open("due")}>
                                                    {l.changeDueLabel}
                                                </Button>
                                                {current.isAgent ? (
                                                    <Button variant="ghost" href={l.askHref}>
                                                        {l.askLabel}
                                                    </Button>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    }}
                </SlotView>
            </SurfaceCard>
        </div>
    )
}
