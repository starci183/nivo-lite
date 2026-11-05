import {
    Stack,
    Grid,
    Alert,
    CheckboxGroup,
    ChoiceChips,
    Drawer,
    Form,
    Input,
    Select,
    Text,
    Textarea,
} from "@starci/grammar/common"

import { DrawerFooter } from "@/components/composites/DrawerFooter"
import type { FactDrawerView } from "@/modules/types"

/** What the drawer that writes a fact draws: its words and values, and what it does. */
interface FactFormDrawerProps {
    readonly props: FactDrawerView["props"]
    readonly on: FactDrawerView["on"]
}

/** Draws the drawer that writes a fact, or a new value for one in force. */
export const FactFormDrawer = (props: FactFormDrawerProps) => (
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
                {props.props.question === undefined ? null : <Text isStrong>{props.props.question}</Text>}
                {props.props.context === undefined ? null : <Text tone="muted">{props.props.context}</Text>}
                {props.props.isEditing ? null : renderFactSubjectFields(props)}
                <Textarea
                    id="brain-fact-value"
                    name="value"
                    label={props.props.valueLabel}
                    rows={props.props.isEditing ? 2 : 3}
                    isRequired
                    value={props.props.value}
                    isDisabled={props.props.isPending}
                    onValueChange={props.on.setValue}
                />
                <Stack gap="row">
                    <ChoiceChips
                        label={props.props.scopeLabel}
                        options={props.props.scopeOptions.map((one) => ({ value: one.id, label: one.label }))}
                        value={props.props.scope}
                        empty={null}
                        onValueChange={props.on.setScope}
                    />
                    <Text size="xs" tone="muted">
                        {props.props.scopeHint}
                    </Text>
                </Stack>
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
                    placeholder={props.props.notePlaceholder}
                    value={props.props.note}
                    isDisabled={props.props.isPending}
                    onValueChange={props.on.setNote}
                />
                {props.props.error === undefined ? null : (
                    <Alert tone="negative" title={props.props.failTitle} description={props.props.error} />
                )}
            </Stack>
        </Form>
    </Drawer>
)

/** Draws the two days the value holds between. */
const renderFactValidityFields = (props: FactFormDrawerProps) => (
    <Grid kind="form" columns={2}>
        <Input
            id="brain-fact-from"
            name="validFrom"
            label={props.props.fromLabel}
            placeholder="2026-01-31"
            value={props.props.validFrom}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setFrom}
        />
        <Input
            id="brain-fact-to"
            name="validTo"
            label={props.props.toLabel}
            placeholder={props.props.toPlaceholder}
            value={props.props.validTo}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setTo}
        />
    </Grid>
)

/** Draws what the fact is about: its type, its subject and the attribute being recorded. */
const renderFactSubjectFields = (props: FactFormDrawerProps) => (
    <>
        <Select
            label={props.props.typeLabel}
            name="subjectType"
            options={props.props.typeOptions}
            placeholder={props.props.selectPlaceholder}
            value={props.props.subjectType}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setType}
        />
        <Input
            id="brain-fact-subject"
            name="subject"
            label={props.props.subjectLabel}
            description={props.props.subjectHint}
            isRequired
            value={props.props.subject}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setSubject}
        />
        <Input
            id="brain-fact-attribute"
            name="attribute"
            label={props.props.attributeLabel}
            description={props.props.attributeHint}
            isRequired
            value={props.props.attribute}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setAttribute}
        />
    </>
)
