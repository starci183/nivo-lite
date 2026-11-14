import {
    Alert,
    Badge,
    Button,
    Cluster,
    Disclosure,
    EmptyNotice,
    Section,
    Stack,
    Stepper,
    Text,
} from "@starci/grammar/common"
import type { DocBodyView, DocHeadView, NivoBodyView } from "@/modules/types"
import { PHONE_ONLY_CLASS_NAME } from "./classNames"

/** What the body of an opened document draws. */
interface KnowledgeDocBodyProps {
    readonly body: DocBodyView
    /** The chips and the read-again command of the head band, which a phone draws here under the head. */
    readonly chips: DocHeadView["chips"]
    readonly reindex: DocHeadView["reindex"]
    readonly isLoading: boolean
    readonly onReindex: () => void
}

/**
 * The body of an opened document: why it failed or what it lacks, the stage a worker is on while one is, the passages as agents
 * retrieve them (each with the way it is found) and the original text folded away.
 */
export const KnowledgeDocBody = (props: KnowledgeDocBodyProps) => {
    const { body } = props
    return (
        <>
            {props.chips.length === 0 && props.reindex === null ? null : (
                <div className={PHONE_ONLY_CLASS_NAME}>
                    <Stack gap="row">
                        {props.chips.length === 0 ? null : (
                            <Cluster gap="inline">
                                {props.chips.map((chip) => (
                                    <Badge key={chip.label} tone={chip.tone}>
                                        {chip.label}
                                    </Badge>
                                ))}
                            </Cluster>
                        )}
                        {props.reindex === null ? null : (
                            <Button
                                intent="neutral"
                                width="fill"
                                isPending={props.reindex.isPending}
                                isDisabled={props.reindex.isDisabled}
                                onPress={props.onReindex}
                            >
                                {props.reindex.label}
                            </Button>
                        )}
                    </Stack>
                </div>
            )}
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
                caption={body.passages.hint}
                headingLevel={2}
                isLoading={props.isLoading}
                items={body.passages.rows.map((row, index) => ({
                    id: row.id,
                    title: row.text,
                    leading: { position: index + 1, format: "hash" },
                    badges: [{ label: row.chip, tone: "neutral" }],
                }))}
                empty={<EmptyNotice message={body.passages.emptyLabel} />}
            />
            <Disclosure
                chevron="start"
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
