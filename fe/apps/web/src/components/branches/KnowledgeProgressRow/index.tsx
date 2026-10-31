import { Progress, Text } from "@starci/grammar/common"
import { KNOWLEDGE_PROGRESS_ROW_CLASS_NAME, KNOWLEDGE_PROGRESS_ROW_HEAD_CLASS_NAME } from "./classNames"

/** The processing row of one document with every word resolved. */
export interface KnowledgeProgressRowProps {
    /** What is going on: "Dang xu ly". */
    readonly title: string
    /** The stage a worker is on. */
    readonly stage: string
    /** How many passages of the stage are done, or null when the stage has no count. */
    readonly count: string | null
    /** 0 to 100. */
    readonly value: number
    /** What the bar measures, for assistive technology. */
    readonly label: string
}

/** The live row under a document a worker is on: its title, the stage with its count, and a bar that moves as the stream pushes. */
export const KnowledgeProgressRow = (props: KnowledgeProgressRowProps) => (
    <div className={KNOWLEDGE_PROGRESS_ROW_CLASS_NAME}>
        <div className={KNOWLEDGE_PROGRESS_ROW_HEAD_CLASS_NAME}>
            <Text size="xs" weight="medium">
                {props.title}
            </Text>
            <Text size="xs" tone="muted" live="polite">
                {props.count === null ? props.stage : `${props.stage} · ${props.count}`}
            </Text>
        </div>
        <Progress label={props.label} value={props.value} valueText={`${Math.round(props.value)}%`} />
    </div>
)
