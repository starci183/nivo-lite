import {
    Alert,
    Avatar,
    Badge,
    Button,
    DescriptionList,
    List,
    ListRow,
    SectionHeader,
    Text,
} from "@starci/grammar/common"
import type { AgentGraphAnswerView, AgentGraphDetailView } from "@/modules/types"

/** The seven answers of the selected node, and the commands that go with a branch. */
type AgentGraphDetailProps = {
    readonly view: AgentGraphDetailView
    readonly isSkeleton: boolean
    readonly onEdit: () => void
    readonly onRuns: () => void
}

/** One answer of the node and whether it waits for its data. */
interface AnswerBodyProps {
    readonly answer: AgentGraphAnswerView
    readonly isSkeleton: boolean
}

/** One answer in the shape its kind draws: a sentence, a list of lines, the approver or the rules behind it. */
const AnswerBody = (props: AnswerBodyProps) => {
    const { answer } = props
    if (answer.kind === "text")
        return (
            <Text size="sm" isSkeleton={props.isSkeleton}>
                {answer.text}
            </Text>
        )
    if (answer.kind === "lines") {
        return (
            <List label={answer.term}>
                {answer.lines.map((line) => (
                    <ListRow
                        key={`${line.label}-${line.note}`}
                        isSkeleton={props.isSkeleton}
                        title={line.label}
                        description={line.note}
                    />
                ))}
            </List>
        )
    }
    if (answer.kind === "approver") {
        return (
            <List label={answer.term}>
                <ListRow
                    isSkeleton={props.isSkeleton}
                    leading={<Avatar name={answer.name} size="sm" isDecorative />}
                    title={answer.name}
                    description={answer.coverage}
                >
                    <Text size="sm" isSkeleton={props.isSkeleton}>
                        {answer.timeout}
                    </Text>
                </ListRow>
            </List>
        )
    }
    return (
        <List label={answer.term}>
            {answer.sources.map((source) => (
                <ListRow
                    key={source.id}
                    isSkeleton={props.isSkeleton}
                    title={source.quote}
                    description={source.place}
                    badges={<Badge isSkeleton={props.isSkeleton}>{source.kindLabel}</Badge>}
                />
            ))}
        </List>
    )
}

/** A node or a branch in plain words: the problem found on it first, then every answer, none of them blank. */
export const AgentGraphDetail = (props: AgentGraphDetailProps) => (
    <>
        <SectionHeader
            level={3}
            title={props.view.title}
            description={props.view.subtitle}
            isSkeleton={props.isSkeleton}
            meta={<Badge isSkeleton={props.isSkeleton}>{props.view.badge}</Badge>}
        />
        {props.view.problem === "" ? null : (
            <Alert
                title={props.view.problemTitle}
                description={props.view.problem}
                tone="cautionary"
                appearance="soft"
            />
        )}
        <DescriptionList
            layout="stacked"
            isDivided
            isLoading={props.isSkeleton}
            items={props.view.answers.map((answer) => ({
                id: answer.id,
                term: answer.term,
                description: <AnswerBody answer={answer} isSkeleton={props.isSkeleton} />,
            }))}
        />
        {props.view.editLabel === "" ? null : (
            <Button intent="commit" size="sm" isSkeleton={props.isSkeleton} onPress={props.onEdit}>
                {props.view.editLabel}
            </Button>
        )}
        {props.view.runsLabel === "" ? null : (
            <Button intent="neutral" size="sm" isSkeleton={props.isSkeleton} onPress={props.onRuns}>
                {props.view.runsLabel}
            </Button>
        )}
    </>
)
