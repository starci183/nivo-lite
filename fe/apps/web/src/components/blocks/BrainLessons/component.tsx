import { Button, Disclosure, Form, Input, Select, Textarea, Cluster, Stack } from "@starci/grammar/common"
import {
    KNOWLEDGE_ROWS_PLACEHOLDER,
    KnowledgeRowList,
    KnowledgeRowsSection,
    rowListPropsOf,
} from "@/components/composites/KnowledgeRows"
import type { KnowledgeListView } from "@/modules/types"
import { SlotView } from "@/components/composites/SlotView"

/** The words and values of the part that studies corrections and writes a lesson by hand. */
interface WriteView {
    readonly agentLabel: string
    readonly agentOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly agent: string
    readonly agentPlaceholder: string
    readonly mineLabel: string
    readonly addTitle: string
    readonly titleLabel: string
    readonly bodyLabel: string
    readonly whenLabel: string
    readonly saveLabel: string
    readonly lessonTitle: string
    readonly lessonBody: string
    readonly lessonWhen: string
    readonly isPending: boolean
}

/** The list and the writing part the connected lessons supply. */
export interface BrainLessonsBaseProps {
    readonly props: {
        readonly list: KnowledgeListView
        /** Owners and managers only; nothing is drawn for it while undefined. */
        readonly write?: WriteView | undefined
    }
    readonly on: {
        readonly setAgent: (value: string | null) => void
        readonly setLessonTitle: (value: string) => void
        readonly setLessonBody: (value: string) => void
        readonly setLessonWhen: (value: string) => void
        readonly mine: () => void
        readonly save: () => void
        readonly retry: () => void
        readonly action: (rowId: string, actionId: string) => void
    }
}

/** What the writing part draws and calls. */
interface WritePartProps {
    readonly view: WriteView
    readonly on: BrainLessonsBaseProps["on"]
}

/** Draws the choice of an agent, the button that studies its corrections and the form that writes a lesson by hand. */
const WritePart = (props: WritePartProps) => (
    <>
        <Cluster gap="row" align="end">
            <Select
                label={props.view.agentLabel}
                name="agent"
                options={props.view.agentOptions}
                value={props.view.agent === "" ? null : props.view.agent}
                placeholder={props.view.agentPlaceholder}
                isDisabled={props.view.isPending}
                onValueChange={props.on.setAgent}
            />
            <Button intent="neutral" isPending={props.view.isPending} onPress={props.on.mine}>
                {props.view.mineLabel}
            </Button>
        </Cluster>
        <Disclosure
            title={props.view.addTitle}
            body={
                <Form label={props.view.addTitle} onSubmit={props.on.save} isPending={props.view.isPending}>
                    <Stack gap="section">
                        <Input
                            id="brain-lesson-title"
                            name="title"
                            label={props.view.titleLabel}
                            isRequired
                            value={props.view.lessonTitle}
                            isDisabled={props.view.isPending}
                            onValueChange={props.on.setLessonTitle}
                        />
                        <Textarea
                            id="brain-lesson-body"
                            name="body"
                            label={props.view.bodyLabel}
                            rows={3}
                            isRequired
                            value={props.view.lessonBody}
                            isDisabled={props.view.isPending}
                            onValueChange={props.on.setLessonBody}
                        />
                        <Input
                            id="brain-lesson-when"
                            name="appliesWhen"
                            label={props.view.whenLabel}
                            value={props.view.lessonWhen}
                            isDisabled={props.view.isPending}
                            onValueChange={props.on.setLessonWhen}
                        />
                        <Button intent="commit" type="submit" isPending={props.view.isPending}>
                            {props.view.saveLabel}
                        </Button>
                    </Stack>
                </Form>
            }
        />
    </>
)

/** Draws how each agent should work: the lessons in use, the proposed ones to approve, and what lets the owner add more. */
export const BrainLessonsBase = (props: BrainLessonsBaseProps) => {
    const list = props.props.list
    return (
        <KnowledgeRowsSection
            isHeadingInCard
            section={list.section}
            before={props.props.write === undefined ? null : <WritePart view={props.props.write} on={props.on} />}
            body={
                <SlotView
                    slot={list.slot}
                    placeholder={KNOWLEDGE_ROWS_PLACEHOLDER}
                    labels={list.slotLabels}
                    onRetry={props.on.retry}
                    render={(rows, isSkeleton) => (
                        <KnowledgeRowList
                            {...rowListPropsOf(list)}
                            rows={rows}
                            isLoading={isSkeleton}
                            onAction={props.on.action}
                        />
                    )}
                />
            }
        />
    )
}
