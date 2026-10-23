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
        readonly results?: KnowledgeRowsProps | undefined
        readonly error?: string | undefined
    }
    readonly on: {
        readonly setQuestion: (value: string) => void
        readonly setModule: (value: string | null) => void
        readonly setAudience: (value: string) => void
        readonly ask: () => void
    }
}

/** Draws the panel that shows what an agent would find for a question, as a customer or as the team. */
export const KnowledgeAskBase = (props: KnowledgeAskBaseProps) => {
    const { props: panel, on } = props

    return (
        <SurfaceCard label={panel.title} headingLevel={2}>
            <Form label={panel.title} onSubmit={on.ask} isPending={panel.isPending}>
                <div className={STACK_CLASS_NAME}>
                    <Text size="sm" tone="muted">
                        {panel.hint}
                    </Text>
                    <Textarea
                        id="knowledge-ask-question"
                        name="question"
                        label={panel.questionLabel}
                        variant="secondary"
                        rows={2}
                        maxLength={500}
                        placeholder={panel.placeholder}
                        value={panel.question}
                        isDisabled={panel.isPending}
                        isSkeleton={panel.isSkeleton}
                        onValueChange={on.setQuestion}
                    />
                    <div className={CHOICES_CLASS_NAME}>
                        <Select
                            label={panel.moduleLabel}
                            name="module"
                            options={panel.moduleOptions}
                            value={panel.module}
                            isSkeleton={panel.isSkeleton}
                            isDisabled={panel.isPending}
                            onValueChange={on.setModule}
                        />
                        <SegmentedControl
                            label={panel.audienceLabel}
                            name="audience"
                            options={panel.audienceOptions.map((one) => ({ value: one.id, label: one.label }))}
                            value={panel.audience}
                            isSkeleton={panel.isSkeleton}
                            isDisabled={panel.isPending}
                            onValueChange={on.setAudience}
                        />
                    </div>
                    <FormActions
                        failTitle={panel.failTitle}
                        error={panel.error}
                        submitLabel={panel.submitLabel}
                        isPending={panel.isPending}
                        isSkeleton={panel.isSkeleton}
                    />
                    {panel.results === undefined ? null : <KnowledgeRows {...panel.results} />}
                </div>
            </Form>
        </SurfaceCard>
    )
}
