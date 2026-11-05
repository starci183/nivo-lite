import { Drawer, Form, Input, Select, Stack, Textarea } from "@starci/grammar/common"
import { DrawerFooter } from "@/components/composites/DrawerFooter"
import type { LessonDrawerView } from "@/modules/types"

/** What the drawer that writes a lesson draws. */
type LessonFormDrawerProps = LessonDrawerView

/** Draws the drawer that writes a lesson by hand: which agent it is for, what it is, what to do and when it applies. */
export const LessonFormDrawer = (props: LessonFormDrawerProps) => (
    <Drawer
        isOpen={props.props.isOpen}
        onOpenChange={(open) => {
            if (!open) props.on.close()
        }}
        title={props.props.title}
        closeLabel={props.props.closeLabel}
        placement="right"
        footer={
            <DrawerFooter
                cancelLabel={props.props.cancelLabel}
                submitLabel={props.props.saveLabel}
                isPending={props.props.isPending}
                onCancel={props.on.close}
                onSubmit={props.on.submit}
            />
        }
    >
        <Form label={props.props.title} onSubmit={props.on.submit} isPending={props.props.isPending}>
            <Stack gap="section">
                <Select
                    label={props.props.agentLabel}
                    name="agent"
                    options={props.props.agentOptions}
                    value={props.props.agent}
                    placeholder={props.props.agentPlaceholder}
                    isDisabled={props.props.isPending}
                    onValueChange={props.on.setAgent}
                />
                <Input
                    id="brain-lesson-title"
                    name="title"
                    label={props.props.titleLabel}
                    isRequired
                    value={props.props.lessonTitle}
                    isDisabled={props.props.isPending}
                    onValueChange={props.on.setTitle}
                />
                <Textarea
                    id="brain-lesson-body"
                    name="body"
                    label={props.props.bodyLabel}
                    rows={3}
                    isRequired
                    value={props.props.lessonBody}
                    isDisabled={props.props.isPending}
                    onValueChange={props.on.setBody}
                />
                <Input
                    id="brain-lesson-when"
                    name="appliesWhen"
                    label={props.props.whenLabel}
                    value={props.props.lessonWhen}
                    isDisabled={props.props.isPending}
                    onValueChange={props.on.setWhen}
                />
            </Stack>
        </Form>
    </Drawer>
)
