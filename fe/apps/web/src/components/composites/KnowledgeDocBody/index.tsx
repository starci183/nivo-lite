import { Alert, Disclosure, EmptyNotice, Section, Stepper, Text } from "@starci/grammar/common"
import type { DocBodyView, NivoBodyView } from "@/modules/types"

/** What the body of an opened document draws. */
interface KnowledgeDocBodyProps {
    readonly body: DocBodyView
    readonly isLoading: boolean
}

/**
 * The body of an opened document: why it failed or what it lacks, the stage a worker is on while one is, the passages as agents
 * retrieve them (each with the way it is found) and the original text folded away.
 */
export const KnowledgeDocBody = (props: KnowledgeDocBodyProps) => {
    const { body } = props
    return (
        <>
            {body.note === null ? null : <Alert tone={body.note.tone} title={body.note.text} />}
            {body.stage === null ? null : (
                <Stepper
                    label={body.stage.label}
                    steps={body.stage.steps}
                    currentStepId={body.stage.currentId}
                    size="dense"
                />
            )}
            <Section
                kind="list"
                title={body.passages.title}
                meta={body.passages.count}
                description={body.passages.hint}
                headingLevel={2}
                isLoading={props.isLoading}
                items={body.passages.rows.map((row, index) => ({
                    id: row.id,
                    title: row.text,
                    leading: { position: index + 1 },
                    badges: [{ label: row.chip, tone: "neutral" }],
                }))}
                empty={<EmptyNotice message={body.passages.emptyLabel} />}
            />
            <Disclosure
                title={body.content.title}
                body={
                    <Text size="sm" isLoading={props.isLoading}>
                        {body.content.text}
                    </Text>
                }
            />
        </>
    )
}

/** What the body of an opened item of the base knowledge draws. */
interface KnowledgeNivoBodyProps {
    readonly body: NivoBodyView
    readonly isLoading: boolean
}

/** The body of an opened item of the base knowledge: the notice that NIVO keeps it (read only) and its numbered lines. */
export const KnowledgeNivoBody = (props: KnowledgeNivoBodyProps) => (
    <>
        <Alert tone="informative" title={props.body.noticeTitle} description={props.body.noticeBody} />
        <Section
            kind="list"
            title={props.body.contentTitle}
            headingLevel={2}
            isLoading={props.isLoading}
            items={props.body.lines.map((line, index) => ({
                id: `line-${index + 1}`,
                title: line,
                leading: { position: index + 1 },
            }))}
            empty={<EmptyNotice message={props.body.contentTitle} />}
        />
    </>
)
