import { Alert, CheckboxGroup, Drawer, Form, Input, RadioGroup, Select, Text, Textarea } from "@starci/grammar/common"
import { DrawerFooter } from "@/components/composites/DrawerFooter"
import { DAYS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** One choice of a select, a radio group or a check group. */
interface ChoiceView {
    readonly id: string
    readonly label: string
}

/** Copy, values and state the connected fact form supplies. */
export interface BrainFactFormBaseProps {
    readonly props: {
        readonly title: string
        readonly closeLabel: string
        readonly cancelLabel: string
        readonly saveLabel: string
        readonly failTitle: string
        readonly isOpen: boolean
        readonly isPending: boolean
        /** The customer question the fact answers, kept in view while it is written. */
        readonly question?: string
        readonly typeLabel: string
        readonly typeOptions: ReadonlyArray<ChoiceView>
        readonly subjectLabel: string
        readonly subjectHint: string
        readonly attributeLabel: string
        readonly attributeHint: string
        readonly valueLabel: string
        readonly scopeLabel: string
        readonly scopeOptions: ReadonlyArray<ChoiceView>
        readonly modulesLabel: string
        readonly moduleOptions: ReadonlyArray<ChoiceView>
        readonly fromLabel: string
        readonly toLabel: string
        readonly noteLabel: string
        readonly subjectType: string
        readonly subject: string
        readonly attribute: string
        readonly value: string
        readonly scope: string
        readonly modules: ReadonlyArray<string>
        readonly validFrom: string
        readonly validTo: string
        readonly note: string
        readonly error?: string
    }
    readonly on: {
        readonly close: () => void
        readonly submit: () => void
        readonly setType: (value: string | null) => void
        readonly setSubject: (value: string) => void
        readonly setAttribute: (value: string) => void
        readonly setValue: (value: string) => void
        readonly setScope: (value: string) => void
        readonly setModules: (value: ReadonlyArray<string>) => void
        readonly setFrom: (value: string) => void
        readonly setTo: (value: string) => void
        readonly setNote: (value: string) => void
    }
}

/** Draws the drawer that writes a fact, or a new value for one in force. */
export const BrainFactFormBase = (props: BrainFactFormBaseProps) => (
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
            <div className={FORM_CLASS_NAME}>
                {props.props.question === undefined ? null : <Text weight="semibold">{props.props.question}</Text>}
                {renderFactSubjectFields(props)}
                <RadioGroup
                    label={props.props.scopeLabel}
                    name="scope"
                    orientation="vertical"
                    options={props.props.scopeOptions.map((one) => ({ value: one.id, label: one.label }))}
                    value={props.props.scope}
                    isDisabled={props.props.isPending}
                    onValueChange={props.on.setScope}
                />
                {props.props.scope === "restricted" ? (
                    <CheckboxGroup
                        label={props.props.modulesLabel}
                        name="modules"
                        options={props.props.moduleOptions.map((one) => ({ value: one.id, label: one.label }))}
                        value={[...props.props.modules]}
                        isDisabled={props.props.isPending}
                        onValueChange={props.on.setModules}
                    />
                ) : null}
                {renderFactValidityFields(props)}
                <Input
                    id="brain-fact-note"
                    name="note"
                    label={props.props.noteLabel}
                    variant="secondary"
                    value={props.props.note}
                    isDisabled={props.props.isPending}
                    onValueChange={props.on.setNote}
                />
                {props.props.error === undefined ? null : (
                    <Alert tone="negative" title={props.props.failTitle} description={props.props.error} />
                )}
            </div>
        </Form>
    </Drawer>
)

/** Draws the div section of the BrainFactForm view. */
const renderFactValidityFields = (props: BrainFactFormBaseProps) => (
    <div className={DAYS_CLASS_NAME}>
        <Input
            id="brain-fact-from"
            name="validFrom"
            label={props.props.fromLabel}
            variant="secondary"
            placeholder="2026-01-31"
            value={props.props.validFrom}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setFrom}
        />
        <Input
            id="brain-fact-to"
            name="validTo"
            label={props.props.toLabel}
            variant="secondary"
            placeholder="2026-12-31"
            value={props.props.validTo}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setTo}
        />
    </div>
)

/** Draws the subject, attribute and value being recorded. */
const renderFactSubjectFields = (props: BrainFactFormBaseProps) => (
    <>
        <Select
            label={props.props.typeLabel}
            name="subjectType"
            options={props.props.typeOptions}
            value={props.props.subjectType}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setType}
        />
        <Input
            id="brain-fact-subject"
            name="subject"
            label={props.props.subjectLabel}
            variant="secondary"
            hint={props.props.subjectHint}
            isRequired
            value={props.props.subject}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setSubject}
        />
        <Input
            id="brain-fact-attribute"
            name="attribute"
            label={props.props.attributeLabel}
            variant="secondary"
            hint={props.props.attributeHint}
            isRequired
            value={props.props.attribute}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setAttribute}
        />
        <Textarea
            id="brain-fact-value"
            name="value"
            label={props.props.valueLabel}
            variant="secondary"
            rows={3}
            isRequired
            value={props.props.value}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setValue}
        />
    </>
)
