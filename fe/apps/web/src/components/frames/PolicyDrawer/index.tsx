import { parseDate } from "@internationalized/date"
import { Alert, DatePicker, Drawer, Fieldset, Form, Select, Stack, Switch } from "@starci/grammar/common"
import { DrawerFooter } from "@/components/composites/DrawerFooter"
import { PolicyValueField } from "@/components/composites/PolicyValueField"
import { PolicyVersionLists } from "@/components/composites/PolicyVersionLists"
import type { PolicyDrawerView, PolicyEffective } from "@/modules/types"

/** What the drawer that edits one shop rule draws, and what it does. */
interface PolicyDrawerProps {
    readonly props: PolicyDrawerView["props"]
    readonly on: PolicyDrawerView["on"]
}

const EFFECTIVE: ReadonlyArray<PolicyEffective> = ["now", "from"]

/** Who may know the value: the readers today, and the owner's switch that lets customer-facing agents tell customers. */
const AudienceField = (props: PolicyDrawerProps) => (
    <Fieldset legend={props.props.copy.audienceLabel} description={props.props.readers}>
        <Switch
            label={props.props.copy.customersLabel}
            description={props.props.copy.customersHint}
            isSelected={props.props.form.customers}
            isDisabled={props.props.isPending}
            onSelectedChange={(customers) => props.on.patch({ customers })}
        />
    </Fieldset>
)

/** When the new value takes effect: now, or from the start of a chosen day. */
const EffectiveField = (props: PolicyDrawerProps) => (
    <Stack gap="row">
        <Select
            label={props.props.copy.effectiveLabel}
            options={props.props.copy.effectiveOptions}
            value={props.props.form.effective}
            isDisabled={props.props.isPending}
            onValueChange={(value) => {
                const effective = EFFECTIVE.find((one) => one === value)
                if (effective !== undefined) props.on.patch({ effective })
            }}
        />
        {props.props.form.effective === "from" ? (
            <DatePicker
                label={props.props.copy.fromDateLabel}
                value={parseDate(props.props.form.date)}
                minValue={parseDate(props.props.form.date)}
                isDisabled={props.props.isPending}
                onValueChange={(value) => {
                    if (value !== null) props.on.patch({ date: value.toString() })
                }}
            />
        ) : null}
    </Stack>
)

/** The form of the drawer: value, who may know it, when it takes effect, the proposals and the history. */
const PolicyForm = (props: PolicyDrawerProps) => (
    <Form label={props.props.title} onSubmit={props.on.submit} isPending={props.props.isPending}>
        <PolicyValueField props={props.props} on={{ patch: props.on.patch }} />
        <AudienceField {...props} />
        <EffectiveField {...props} />
        <PolicyVersionLists props={props.props} on={{ use: props.on.use, reject: props.on.reject }} />
        {props.props.error === undefined ? null : (
            <Alert tone="negative" title={props.props.copy.failTitle} description={props.props.error} />
        )}
    </Form>
)

/**
 * Draws the drawer that edits one shop rule (a short form; the owner only): under the title the AI's reason why it is a rule, the typed value, who may know it with the customers
 * switch, when it takes effect (now or from a day), the proposals waiting and the history as bordered lists, then cancel and the one
 * red save.
 */
export const PolicyDrawer = (props: PolicyDrawerProps) => (
    <Drawer
        isOpen={props.props.isOpen}
        onOpenChange={(open) => {
            if (!open) props.on.close()
        }}
        title={props.props.title}
        {...(props.props.reason === undefined ? {} : { description: props.props.reason })}
        closeLabel={props.props.copy.closeLabel}
        placement="right"
        isLoading={props.props.isLoading}
        footer={
            props.props.isFailed ? undefined : (
                <DrawerFooter
                    cancelLabel={props.props.copy.cancelLabel}
                    submitLabel={props.props.copy.saveLabel}
                    isPending={props.props.isPending}
                    onCancel={props.on.close}
                    onSubmit={props.on.submit}
                />
            )
        }
    >
        {props.props.isFailed ? (
            <Alert tone="negative" title={props.props.copy.loadFailed} />
        ) : (
            <PolicyForm {...props} />
        )}
    </Drawer>
)
