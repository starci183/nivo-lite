import { Alert, Avatar, Cluster, Badge, Button, DescriptionList, Stack, Text, Section } from "@starci/grammar/common"
import type { AgentGraphAnswerView, AgentGraphDetailView } from "@/modules/types"

/** The seven answers of the selected node, and the commands that go with a branch. */
type AgentGraphDetailProps = {
    readonly view: AgentGraphDetailView
    readonly isLoading: boolean
    readonly onEdit: (nodeKey: string) => void
    readonly onRuns: () => void
}

/** One answer of the node and whether it waits for its data. */
interface AnswerBodyProps {
    readonly answer: AgentGraphAnswerView
    readonly isLoading: boolean
}

/** One answer in the shape its kind draws: a sentence, a list of lines, the approver or the rules behind it. */
const AnswerBody = (props: AnswerBodyProps) => {
    const { answer } = props
    if (answer.kind === "text")
        return (
            <Text size="sm" isLoading={props.isLoading === true}>
                {answer.text}
            </Text>
        )
    if (answer.kind === "lines")
        return (
            <DescriptionList
                isLoading={props.isLoading === true}
                items={answer.lines.map((line) => ({ id: line.label, term: line.label, description: line.note }))}
            />
        )
    if (answer.kind === "approver")
        return (
            <Cluster gap="inline">
                <Avatar name={answer.name} size="sm" isDecorative isLoading={props.isLoading === true} />
                <Stack gap="identity">
                    <Text isLoading={props.isLoading === true}>{answer.name}</Text>
                    <Text size="sm" tone="muted" isLoading={props.isLoading === true}>
                        {answer.coverage}
                    </Text>
                    <Text size="sm" isLoading={props.isLoading === true}>
                        {answer.timeout}
                    </Text>
                </Stack>
            </Cluster>
        )
    return (
        <DescriptionList
            isLoading={props.isLoading === true}
            items={answer.sources.map((source) => ({
                id: source.id,
                term: source.kindLabel,
                description: (
                    <Stack gap="identity">
                        <Text isLoading={props.isLoading === true}>{source.quote}</Text>
                        <Text size="sm" tone="muted" isLoading={props.isLoading === true}>
                            {source.place}
                        </Text>
                    </Stack>
                ),
            }))}
        />
    )
}

/** A node or a branch in plain words: the problem found on it first, then every answer, none of them blank. */
export const AgentGraphDetail = (props: AgentGraphDetailProps) => (
    <Section
        title={props.view.title}
        description={props.view.subtitle}
        isLoading={props.isLoading === true}
        action={<Badge isLoading={props.isLoading === true}>{props.view.badge}</Badge>}
        headingLevel={3}
    >
        {props.view.problems.length === 0 ? null : (
            <Alert
                title={props.view.problemTitle}
                description={
                    <Stack gap="inline">
                        {props.view.problems.map((problem) => (
                            <Text key={problem} size="sm">
                                {problem}
                            </Text>
                        ))}
                    </Stack>
                }
                tone="cautionary"
                appearance="soft"
            />
        )}
        <DescriptionList
            layout="stacked"
            isDivided
            isLoading={props.isLoading === true}
            items={props.view.answers.map((answer) => ({
                id: answer.id,
                term: answer.term,
                description: <AnswerBody answer={answer} isLoading={props.isLoading === true} />,
            }))}
        />
        {props.view.editLabel === "" ? null : (
            <Button
                intent="commit"
                size="sm"
                isLoading={props.isLoading === true}
                onPress={() => props.onEdit(props.view.editNodeKey)}
            >
                {props.view.editLabel}
            </Button>
        )}
        {props.view.runsLabel === "" ? null : (
            <Button intent="neutral" size="sm" isLoading={props.isLoading === true} onPress={props.onRuns}>
                {props.view.runsLabel}
            </Button>
        )}
    </Section>
)
