import { Button, Disclosure, Form, Input, Select, Textarea } from "@starci/grammar/common"
import { KnowledgeRows } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowsProps } from "@/components/composites/KnowledgeRows"
import { FORM_CLASS_NAME, MINE_CLASS_NAME } from "./classNames"

/** The words and values of the part that studies corrections and writes a lesson by hand. */
interface WriteView {
    readonly agentLabel: string
    readonly agentOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly agent: string
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
        readonly list: KnowledgeRowsProps
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
        <div className={MINE_CLASS_NAME}>
            <Select
                label={props.view.agentLabel}
                name="agent"
                options={props.view.agentOptions}
                value={props.view.agent}
                isDisabled={props.view.isPending}
                onValueChange={props.on.setAgent}
            />
            <Button variant="outline" isPending={props.view.isPending} onPress={props.on.mine}>
                {props.view.mineLabel}
            </Button>
        </div>
        <Disclosure title={props.view.addTitle}>
            <Form label={props.view.addTitle} onSubmit={props.on.save} isPending={props.view.isPending}>
                <div className={FORM_CLASS_NAME}>
                    <Input
                        id="brain-lesson-title"
                        name="title"
                        label={props.view.titleLabel}
                        variant="secondary"
                        isRequired
                        value={props.view.lessonTitle}
                        isDisabled={props.view.isPending}
                        onValueChange={props.on.setLessonTitle}
                    />
                    <Textarea
                        id="brain-lesson-body"
                        name="body"
                        label={props.view.bodyLabel}
                        variant="secondary"
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
                        variant="secondary"
                        value={props.view.lessonWhen}
                        isDisabled={props.view.isPending}
                        onValueChange={props.on.setLessonWhen}
                    />
                    <Button variant="primary" type="submit" isPending={props.view.isPending}>
                        {props.view.saveLabel}
                    </Button>
                </div>
            </Form>
        </Disclosure>
    </>
)

/** Draws how each agent should work: the lessons in use, the proposed ones to approve, and what lets the owner add more. */
export const BrainLessonsBase = (props: BrainLessonsBaseProps) => (
    <KnowledgeRows
        {...props.props.list}
        before={props.props.write === undefined ? null : <WritePart view={props.props.write} on={props.on} />}
    />
)
