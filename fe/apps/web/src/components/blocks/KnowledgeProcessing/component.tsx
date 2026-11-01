import { ListRow, Stepper, SurfaceListCard, Text } from "@starci/grammar/common"
import type { StepperStep } from "@starci/grammar/common"
import { STEPS_CLASS_NAME } from "./classNames"

/** One document a worker is on: its name, how far it got and the stage it is in. */
export interface ProcessingRowView {
    readonly id: string
    readonly title: string
    /** How far the reading is, as a percent with its sign. */
    readonly percentLabel: string
    /** The id of the stage the worker is on. */
    readonly stageId: string
}

/** Copy and values the list of documents being taken in supplies. */
export interface KnowledgeProcessingBaseProps {
    readonly props: {
        readonly title: string
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<StepperStep>
        readonly rows: ReadonlyArray<ProcessingRowView>
    }
}

/** Draws each document being taken in with its four stages: the finished ones complete, the one a worker is on current. */
export const KnowledgeProcessingBase = (props: KnowledgeProcessingBaseProps) => (
    <SurfaceListCard label={props.props.title} empty={null}>
        {props.props.rows.map((row) => (
            <ListRow key={row.id} title={row.title} actions={<Text tone="muted">{row.percentLabel}</Text>}>
                <div className={STEPS_CLASS_NAME}>
                    <Stepper
                        label={`${props.props.stepsLabel}: ${row.title}`}
                        steps={props.props.steps}
                        currentStepId={row.stageId}
                        size="dense"
                    />
                </div>
            </ListRow>
        ))}
    </SurfaceListCard>
)
