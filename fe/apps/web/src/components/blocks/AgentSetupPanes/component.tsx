import { Alert, Button, Divider, EmptyNotice, Heading, Pane, PaneGrid, PaneSection, Text } from "@starci/grammar/common"
import type { PaneGridProps } from "@starci/grammar/common"
import type { ReactNode, Ref } from "react"
import { SetupMeter } from "@/components/branches/SetupMeter"
import { AgentSetupChecklist } from "@/components/composites/AgentSetupChecklist"
import { AgentSetupComposer, type AgentSetupComposerContent } from "@/components/composites/AgentSetupComposer"
import { AgentSetupThread, type AgentSetupThreadContent } from "@/components/composites/AgentSetupThread"
import { SetupDraftCard } from "@/components/composites/SetupDraftCard"
import { SetupKnowledgeCard } from "@/components/composites/SetupKnowledgeCard"
import { SetupVersionsCard } from "@/components/composites/SetupVersionsCard"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SetupSideView, SetupWriteDecision, SlotLabels } from "@/modules/types"
import type { BrandProposalCommands } from "@/components/leaves/BrandProposalView"

/** What the chat draws once the setup is in: the thread and the composer. */
export interface AgentSetupChatContent extends AgentSetupThreadContent, AgentSetupComposerContent {}

/** The words of the panes that do not come from a slot. */
export interface AgentSetupCopy {
    readonly paneLabel: string
    readonly checklistLabel: string
    readonly chatLabel: string
    readonly chatTitle: string
    readonly chatHint: string
    readonly proposalsLabel: string
    readonly confirmLabel: string
    readonly proposalEditLabel: string
    readonly suggestionsLabel: string
    /** "NIVO is asking in the chat", under the current gate. */
    readonly askingLabel: string
}

/** The two slots, the copy, the notice for anyone who may not set an agent up, and the commands of the setup panes. */
export interface AgentSetupPanesBaseProps {
    readonly props: {
        readonly copy: AgentSetupCopy
        readonly chat: DataSlot<AgentSetupChatContent>
        readonly chatPlaceholder: AgentSetupChatContent
        readonly side: DataSlot<SetupSideView>
        readonly sidePlaceholder: SetupSideView
        readonly slotLabels: SlotLabels
        /** The notice shown instead of the panes; empty when the person may set the agent up. */
        readonly forbidden: string
        /** The thread band, the scroll owner that opens at the newest message. */
        readonly threadRef: Ref<HTMLDivElement>
    }
    readonly on: {
        readonly text: (value: string) => void
        readonly send: () => void
        readonly suggest: (id: string) => void
        readonly decide: (id: string, change: SetupWriteDecision) => void
        readonly attach: (files: ReadonlyArray<File>) => void
        readonly brandField: (name: Parameters<BrandProposalCommands["field"]>[0], value: string) => void
        readonly brandConfirm: (id: string) => void
        readonly brandToggleEdit: (id: string) => void
        readonly brandReject: (id: string) => void
        readonly editText: (value: string) => void
        readonly gate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => void
        readonly startEdit: (gateKey: string, evidence: string) => void
        readonly stopEdit: () => void
        readonly apply: () => void
        readonly open: (href: string) => void
        readonly retryChat: () => void
        readonly retrySide: () => void
    }
}

/**
 * The arrangement (pane-grid.choose.frame grid; the bands of one row share their edges): on a laptop the checklist on the
 * surface at the left (progress, the items, the run action) beside the chat (head, thread, composer), the progress band level
 * with the chat head and the run action level with the composer. On a phone the checklist stacks above the chat, each with an equal share of the height the head and the composer leave.
 */
const AREAS: PaneGridProps["areas"] = {
    base: ["progress", "gates", "apply", "head", "thread", "composer"],
    medium: ["progress head", "gates thread", "apply composer"],
}
const COLUMNS: PaneGridProps["columns"] = {
    base: ["fill"],
    medium: ["standard", "fill"],
    wide: ["wide", "fill"],
}
const ROWS: PaneGridProps["rows"] = {
    base: ["auto", "fill", "auto", "auto", "fill", "auto"],
    medium: ["auto", "fill", "auto"],
}

/** The gates view of the checklist and whether it is a placeholder. */
interface GatesBandProps {
    readonly gates: SetupSideView["gates"]
    readonly isSkeleton: boolean
}

/** The gates band with the command of the run action. */
interface ApplyProps extends GatesBandProps {
    readonly apply: () => void
}

/** The run action pinned under the checklist, with its hint and what the last apply said. */
const Apply = (props: ApplyProps) => (
    <>
        <Button
            intent="alternative"
            width="fill"
            isSkeleton={props.isSkeleton}
            isPending={props.gates.isApplying}
            isDisabled={!props.gates.canApply}
            onPress={props.apply}
        >
            {props.gates.applyLabel}
        </Button>
        <Text size="xs" tone="muted" isSkeleton={props.isSkeleton}>
            {props.gates.applyHint}
        </Text>
        {props.gates.applyTone === "idle" ? null : (
            <Alert title={props.gates.applyTitle} description={props.gates.applyText} tone="affirmative" />
        )}
    </>
)

/** The progress of the checklist: how many of the items the owner confirmed. */
const Progress = (props: GatesBandProps) => (
    <SetupMeter
        label={props.gates.title}
        valueLabel={props.gates.progressLabel}
        confirmed={props.gates.confirmed}
        total={props.gates.total}
        isSkeleton={props.isSkeleton}
    />
)

/** A read of the panes with the placeholder of its shape and what retrying it does. */
interface ViewSource<T> {
    readonly slot: DataSlot<T>
    readonly placeholder: T
    readonly onRetry: () => void
}

/** Whether the read can be drawn: loading (as its skeleton) or in (as its content), not failed, forbidden or empty. */
const isDrawable = <T,>(slot: DataSlot<T>): boolean =>
    slot.isLoading === true || (slot.isError !== true && slot.isForbidden !== true && slot.items !== undefined)

/**
 * Draws a read through the one recipe of a slot's status. A read feeds several bands: the band that `says` the status carries
 * its notice and retry, the others draw nothing for a read that failed, so one failure reads as one notice.
 */
const viewOf = <T,>(
    labels: SlotLabels,
    source: ViewSource<T>,
    says: boolean,
    render: (data: T, isSkeleton: boolean) => ReactNode,
) =>
    says || isDrawable(source.slot) ? (
        <SlotView slot={source.slot} placeholder={source.placeholder} labels={labels} onRetry={source.onRetry}>
            {render}
        </SlotView>
    ) : null

/** The checklist read: the gates, the draft, the knowledge and the versions. */
const sideOf = (base: AgentSetupPanesBaseProps): ViewSource<SetupSideView> => ({
    slot: base.props.side,
    placeholder: base.props.sidePlaceholder,
    onRetry: base.on.retrySide,
})

/** The chat read: the messages, the proposals and the composer. */
const chatOf = (base: AgentSetupPanesBaseProps): ViewSource<AgentSetupChatContent> => ({
    slot: base.props.chat,
    placeholder: base.props.chatPlaceholder,
    onRetry: base.on.retryChat,
})

/** The side view whose records are drawn. */
interface RecordsProps {
    readonly view: SetupSideView
    readonly isSkeleton: boolean
}

/** The draft, the knowledge and the versions under the checklist items. */
const Records = (props: RecordsProps) => (
    <>
        <Divider semantics="presentation" />
        <SetupDraftCard {...props.view.draft} isSkeleton={props.isSkeleton} />
        <SetupKnowledgeCard {...props.view.knowledge} isSkeleton={props.isSkeleton} />
        <SetupVersionsCard {...props.view.versions} isSkeleton={props.isSkeleton} />
    </>
)

/**
 * Draws the Setup tab of an agent as one PaneGrid flush under the tab line: on the surface at the left what must be confirmed
 * before the agent runs (progress, the eight items, the run action), beside it the private chat with NIVO that fills them
 * (head, thread, composer). Every band is a PaneSection, so all bands of a pane start at its one content edge.
 */
export const AgentSetupPanesBase = (props: AgentSetupPanesBaseProps) => {
    const { copy } = props.props
    const { on } = props
    const labels = props.props.slotLabels
    if (props.props.forbidden !== "") {
        return (
            <PaneGrid label={copy.paneLabel} areas={["notice"]}>
                <Pane area="notice">
                    <PaneSection align="center">
                        <EmptyNotice message={props.props.forbidden} />
                    </PaneSection>
                </Pane>
            </PaneGrid>
        )
    }
    return (
        <PaneGrid label={copy.paneLabel} areas={AREAS} columns={COLUMNS} rows={ROWS}>
            <Pane area="progress" surface>
                <PaneSection align="center">
                    {viewOf(labels, sideOf(props), false, (view, isSkeleton) => (
                        <Progress gates={view.gates} isSkeleton={isSkeleton} />
                    ))}
                </PaneSection>
            </Pane>
            <Pane area="gates" surface>
                <PaneSection scroll={{ label: copy.checklistLabel }}>
                    {viewOf(labels, sideOf(props), true, (view, isSkeleton) => (
                        <>
                            <AgentSetupChecklist view={view} isSkeleton={isSkeleton} copy={copy} on={on} />
                            <Records view={view} isSkeleton={isSkeleton} />
                        </>
                    ))}
                </PaneSection>
            </Pane>
            <Pane area="apply" surface>
                <PaneSection>
                    {viewOf(labels, sideOf(props), false, (view, isSkeleton) => (
                        <Apply gates={view.gates} isSkeleton={isSkeleton} apply={on.apply} />
                    ))}
                </PaneSection>
            </Pane>
            <Pane area="head" surface>
                <PaneSection align="center" gap="inline">
                    <Heading level={2}>{copy.chatTitle}</Heading>
                    <Text size="xs" tone="muted">
                        {copy.chatHint}
                    </Text>
                </PaneSection>
            </Pane>
            <Pane area="thread">
                <PaneSection
                    scroll={{
                        label: copy.chatLabel,
                        role: "log",
                        tone: "background",
                        scrollRef: props.props.threadRef,
                    }}
                >
                    {viewOf(labels, chatOf(props), true, (content, isSkeleton) => (
                        <AgentSetupThread content={content} isSkeleton={isSkeleton} copy={copy} on={on} />
                    ))}
                </PaneSection>
            </Pane>
            <Pane area="composer" surface>
                <PaneSection>
                    {viewOf(labels, chatOf(props), false, (content, isSkeleton) => (
                        <AgentSetupComposer
                            content={content}
                            isSkeleton={isSkeleton}
                            copy={{ suggestionsLabel: copy.suggestionsLabel, formLabel: copy.chatTitle }}
                            on={on}
                        />
                    ))}
                </PaneSection>
            </Pane>
        </PaneGrid>
    )
}
