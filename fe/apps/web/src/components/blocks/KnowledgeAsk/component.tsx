import { Form, SegmentedControl, Select, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { FormActions } from "@/components/composites/FormActions"
import { KnowledgeRows } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowsProps } from "@/components/composites/KnowledgeRows"
import { CHOICES_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** Copy, values and state the connected question panel supplies. */
export interface KnowledgeAskBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly placeholder: string
        readonly questionLabel: string
        readonly moduleLabel: string
        readonly moduleOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly audienceLabel: string
        readonly audienceOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly submitLabel: string
        readonly failTitle: string
        readonly question: string
        readonly module: string
        readonly audience: string
        readonly isPending: boolean
        /** The panel is loading: the labels stay, the inputs and the action are skeletons. */
        readonly isSkeleton: boolean
        /** The passages found; nothing is drawn for them until a question was asked. */
        readonly results?: KnowledgeRowsProps
        readonly error?: string
    }
    readonly on: {
        readonly setQuestion: (value: string) => void
        readonly setModule: (value: string | null) => void
        readonly setAudience: (value: string) => void
        readonly ask: () => void
    }
}

/** Draws the panel that shows what an agent would find for a question, as a customer or as the team. */
export const KnowledgeAskBase = (props: KnowledgeAskBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <Form label={props.props.title} onSubmit={props.on.ask} isPending={props.props.isPending}>
            <div className={STACK_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {props.props.hint}
                </Text>
                <Textarea
                    id="knowledge-ask-question"
                    name="question"
                    label={props.props.questionLabel}
                    variant="secondary"
                    rows={2}
                    maxLength={500}
                    placeholder={props.props.placeholder}
                    value={props.props.question}
                    isDisabled={props.props.isPending}
                    isSkeleton={props.props.isSkeleton}
                    onValueChange={props.on.setQuestion}
                />
                <div className={CHOICES_CLASS_NAME}>
                    <Select
                        label={props.props.moduleLabel}
                        name="module"
                        options={props.props.moduleOptions}
                        value={props.props.module}
                        isSkeleton={props.props.isSkeleton}
                        isDisabled={props.props.isPending}
                        onValueChange={props.on.setModule}
                    />
                    <SegmentedControl
                        label={props.props.audienceLabel}
                        name="audience"
                        options={props.props.audienceOptions.map((one) => ({ value: one.id, label: one.label }))}
                        value={props.props.audience}
                        isSkeleton={props.props.isSkeleton}
                        isDisabled={props.props.isPending}
                        onValueChange={props.on.setAudience}
                    />
                </div>
                <FormActions
                    failTitle={props.props.failTitle}
                    error={props.props.error}
                    submitLabel={props.props.submitLabel}
                    isPending={props.props.isPending}
                    isSkeleton={props.props.isSkeleton}
                />
                {props.props.results === undefined ? null : <KnowledgeRows {...props.props.results} />}
            </div>
        </Form>
    </SurfaceCard>
)
