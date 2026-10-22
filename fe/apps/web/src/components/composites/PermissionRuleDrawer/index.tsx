import { Button, CheckboxGroup, Drawer, SegmentedControl } from "@starci/grammar/common"
import { PermissionBandsFields } from "@/components/branches/PermissionBandsFields"
import type { PermissionBandsFieldsProps } from "@/components/branches/PermissionBandsFields"
import { PermissionGrantsFields } from "@/components/branches/PermissionGrantsFields"
import type { PermissionGrantsFieldsProps } from "@/components/branches/PermissionGrantsFields"
import { PermissionGroupFields } from "@/components/branches/PermissionGroupFields"
import type { PermissionGroupFieldsProps } from "@/components/branches/PermissionGroupFields"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** One choice of a list, already worded. */
interface ChoiceView {
    readonly id: string
    readonly label: string
}

/** What the drawer edits about one rule, as typed (a number field is NaN while empty). */
interface DraftView {
    readonly strategy: string
    readonly unit: string
    readonly autoMax: number
    readonly askMax: number
    readonly agents: ReadonlyArray<string>
    readonly roles: ReadonlyArray<string>
    readonly rooms: ReadonlyArray<string>
    readonly members: ReadonlyArray<string>
    readonly policy: string
    readonly timeoutMinutes: number
}

/** Every word of the drawer, already resolved: its own and those of the three field groups. */
type DrawerCopy = PermissionBandsFieldsProps["props"]["copy"] &
    PermissionGroupFieldsProps["props"]["copy"] &
    PermissionGrantsFieldsProps["props"]["copy"] & {
        readonly drawerDesc: string
        readonly close: string
        readonly agentsLabel: string
        readonly agentsHint: string
        readonly strategyLabel: string
        readonly save: string
        readonly cancel: string
    }

/** The words and state of the rule drawer. */
export interface PermissionRuleDrawerProps {
    readonly props: {
        /** The rule being changed, already worded: the action and the department. */
        readonly title: string
        readonly draft: DraftView
        readonly grants: PermissionGrantsFieldsProps["props"]["grants"]
        /** Only the owner hands out approval limits. */
        readonly canGrant: boolean
        readonly canSave: boolean
        /** True when the bands typed are not enough to save. */
        readonly isBandsInvalid: boolean
        readonly isPending: boolean
        readonly legend: PermissionBandsFieldsProps["props"]["legend"]
        readonly sliderMax: number
        readonly agentOptions: ReadonlyArray<ChoiceView>
        readonly roomOptions: ReadonlyArray<ChoiceView>
        readonly memberOptions: ReadonlyArray<ChoiceView>
        readonly roleOptions: ReadonlyArray<ChoiceView>
        readonly policyOptions: ReadonlyArray<ChoiceView>
        readonly unitOptions: ReadonlyArray<ChoiceView>
        readonly timeoutOptions: ReadonlyArray<ChoiceView>
        readonly strategyOptions: ReadonlyArray<ChoiceView>
        readonly copy: DrawerCopy
    }
    readonly on: PermissionBandsFieldsProps["on"] &
        PermissionGroupFieldsProps["on"] & {
            readonly agents: (ids: ReadonlyArray<string>) => void
            readonly strategy: (value: string) => void
            readonly grantEnabled: PermissionGrantsFieldsProps["on"]["enabled"]
            readonly grantMax: PermissionGrantsFieldsProps["on"]["max"]
            readonly save: () => void
            readonly close: () => void
        }
}

const optionsOf = (choices: ReadonlyArray<ChoiceView>) => choices.map((one) => ({ value: one.id, label: one.label }))

/** The approver group, how they decide and the approval limits: what a rule that asks a person needs. */
const AskedFields = (props: PermissionRuleDrawerProps) => {
    const { props: p, on } = props
    const draft = p.draft
    return (
        <>
            <PermissionGroupFields
                props={{
                    roles: draft.roles,
                    rooms: draft.rooms,
                    members: draft.members,
                    policy: draft.policy,
                    timeoutMinutes: draft.timeoutMinutes,
                    roleOptions: p.roleOptions,
                    roomOptions: p.roomOptions,
                    memberOptions: p.memberOptions,
                    policyOptions: p.policyOptions,
                    timeoutOptions: p.timeoutOptions,
                    copy: p.copy,
                }}
                on={on}
            />
            <PermissionGrantsFields
                props={{ grants: p.grants, canGrant: p.canGrant, copy: p.copy }}
                on={{ enabled: on.grantEnabled, max: on.grantMax }}
            />
        </>
    )
}

/** The form that sets how far one rule lets an agent go and who approves the rest. */
export const PermissionRuleDrawer = (props: PermissionRuleDrawerProps) => {
    const { props: p, on } = props
    const draft = p.draft
    const asks = draft.strategy === "bands" || draft.strategy === "ask"
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={p.title}
            description={p.copy.drawerDesc}
            closeLabel={p.copy.close}
            placement="right"
        >
            <div className={FORM_CLASS_NAME}>
                <CheckboxGroup
                    variant="secondary"
                    label={p.copy.agentsLabel}
                    description={p.copy.agentsHint}
                    options={optionsOf(p.agentOptions)}
                    value={draft.agents}
                    onValueChange={on.agents}
                />
                <SegmentedControl
                    label={p.copy.strategyLabel}
                    width="fill"
                    options={optionsOf(p.strategyOptions)}
                    value={draft.strategy}
                    onValueChange={on.strategy}
                />
                {draft.strategy === "bands" ? (
                    <PermissionBandsFields
                        props={{
                            unit: draft.unit,
                            autoMax: draft.autoMax,
                            askMax: draft.askMax,
                            sliderMax: p.sliderMax,
                            unitOptions: p.unitOptions,
                            legend: p.legend,
                            isInvalid: p.isBandsInvalid,
                            copy: p.copy,
                        }}
                        on={on}
                    />
                ) : null}
                {asks ? <AskedFields {...props} /> : null}
                <div className={ACTIONS_CLASS_NAME}>
                    <Button variant="primary" isPending={p.isPending} isDisabled={!p.canSave} onPress={on.save}>
                        {p.copy.save}
                    </Button>
                    <Button variant="outline" isDisabled={p.isPending} onPress={on.close}>
                        {p.copy.cancel}
                    </Button>
                </div>
            </div>
        </Drawer>
    )
}
