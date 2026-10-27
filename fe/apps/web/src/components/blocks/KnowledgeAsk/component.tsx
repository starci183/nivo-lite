import { Avatar, Form, SegmentedControl, Select, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { FormActions } from "@/components/composites/FormActions"
import { KNOWLEDGE_ROWS_PLACEHOLDER, KnowledgeRowList } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { CHOICES_CLASS_NAME, IDENTITY_CLASS_NAME, IDENTITY_COPY_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** The agent the question is asked as. */
interface IdentityView {
    readonly id: string
    readonly name: string
    readonly avatarUrl: string | undefined
    readonly caption: string
}

/** One agent the question may be asked as. */
interface AgentOptionView {
    readonly id: string
    readonly label: string
}

/** The passages found for a question, as one slot: an empty one says that nothing was found. */
interface ResultsView {
    readonly label: string
    readonly slot: DataSlot<ReadonlyArray<KnowledgeRowView>>
    readonly slotLabels: SlotLabels
}

/** An agent of the same shape as a ready one. */
const AGENTS_PLACEHOLDER: ReadonlyArray<AgentOptionView> = [{ id: "placeholder", label: "-" }]

/** Copy, values and state the connected question panel supplies. */
export interface KnowledgeAskBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly placeholder: string
        readonly questionLabel: string
        readonly agentLabel: string
        readonly selectPlaceholder: string
        /** The agents installed: the form is drawn from them, and none says so in place of the form. */
        readonly agents: DataSlot<ReadonlyArray<AgentOptionView>>
        readonly agentsLabels: SlotLabels
        readonly audienceLabel: string
        readonly audienceOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly submitLabel: string
        readonly failTitle: string
        readonly question: string
        readonly agent: IdentityView | undefined
        readonly audience: string
        readonly canPickAudience: boolean
        readonly isPending: boolean
        /** The passages found; nothing is drawn for them until a question was asked. */
        readonly results?: ResultsView | undefined
        readonly error?: string | undefined
    }
    readonly on: {
        readonly setQuestion: (value: string) => void
        readonly setAgent: (value: string | null) => void
        readonly setAudience: (value: string) => void
        readonly ask: () => void
        readonly retry: () => void
    }
}

/** What the form draws and calls. */
interface AskFormProps {
    readonly panel: KnowledgeAskBaseProps["props"]
    readonly on: KnowledgeAskBaseProps["on"]
    readonly agents: ReadonlyArray<AgentOptionView>
    readonly isSkeleton: boolean
}

/** What the passages found draw. */
interface ResultsProps {
    readonly results: ResultsView
}

/** What the identity of the agent draws. */
interface IdentityProps {
    readonly agent: IdentityView
}

/** The passages found for the question, as one slot of rows. */
const Results = (props: ResultsProps) => (
    <SlotView slot={props.results.slot} placeholder={KNOWLEDGE_ROWS_PLACEHOLDER} labels={props.results.slotLabels}>
        {(rows, isSkeleton) => (
            <KnowledgeRowList label={props.results.label} rows={rows} isPending={false} isSkeleton={isSkeleton} />
        )}
    </SlotView>
)

/** The agent the question is asked as, and for whom. */
const Identity = (props: IdentityProps) => (
    <div className={IDENTITY_CLASS_NAME}>
        <Avatar
            name={props.agent.name}
            seed={props.agent.id}
            kind="agent"
            {...(props.agent.avatarUrl === undefined ? {} : { src: props.agent.avatarUrl })}
        />
        <div className={IDENTITY_COPY_CLASS_NAME}>
            <Text weight="semibold">{props.agent.name}</Text>
            <Text size="xs" tone="muted">
                {props.agent.caption}
            </Text>
        </div>
    </div>
)

/** The form that asks the question: the agent and the audience, the question and the action, then the passages found. */
const AskForm = (props: AskFormProps) => {
    const { panel, on, isSkeleton } = props
    return (
        <Form label={panel.title} onSubmit={on.ask} isPending={panel.isPending}>
            <div className={STACK_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {panel.hint}
                </Text>
                <div className={CHOICES_CLASS_NAME}>
                    <Select
                        label={panel.agentLabel}
                        name="agent"
                        options={props.agents}
                        placeholder={panel.selectPlaceholder}
                        value={panel.agent?.id ?? null}
                        isSkeleton={isSkeleton}
                        isDisabled={panel.isPending}
                        onValueChange={on.setAgent}
                    />
                    <SegmentedControl
                        label={panel.audienceLabel}
                        name="audience"
                        options={panel.audienceOptions.map((one) => ({ value: one.id, label: one.label }))}
                        value={panel.audience}
                        isSkeleton={isSkeleton}
                        isDisabled={panel.isPending || !panel.canPickAudience}
                        onValueChange={on.setAudience}
                    />
                </div>
                {panel.agent === undefined ? null : <Identity agent={panel.agent} />}
                <Textarea
                    id="knowledge-ask-question"
                    name="question"
                    label={panel.questionLabel}
                    rows={2}
                    maxLength={500}
                    placeholder={panel.placeholder}
                    value={panel.question}
                    isDisabled={panel.isPending}
                    isSkeleton={isSkeleton}
                    onValueChange={on.setQuestion}
                />
                <FormActions
                    failTitle={panel.failTitle}
                    error={panel.error}
                    submitLabel={panel.submitLabel}
                    isPending={panel.isPending}
                    isSkeleton={isSkeleton}
                />
                {panel.results === undefined ? null : <Results results={panel.results} />}
            </div>
        </Form>
    )
}

/** Draws the panel that shows what an agent would find for a question, as a customer or as the team. It only reads. */
export const KnowledgeAskBase = (props: KnowledgeAskBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotView
            slot={props.props.agents}
            placeholder={AGENTS_PLACEHOLDER}
            labels={props.props.agentsLabels}
            onRetry={props.on.retry}
        >
            {(agents, isSkeleton) => (
                <AskForm panel={props.props} on={props.on} agents={agents} isSkeleton={isSkeleton} />
            )}
        </SlotView>
    </SurfaceCard>
)
