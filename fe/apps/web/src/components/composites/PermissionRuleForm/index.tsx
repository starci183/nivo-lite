import { Button, CheckboxGroup, ChoiceChips, Cluster, Stack, SurfaceCard } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { PermissionBandsFields } from "@/components/branches/PermissionBandsFields"
import type { PermissionBandsFieldsProps } from "@/components/branches/PermissionBandsFields"
import type { PermissionGrantsFieldsProps } from "@/components/branches/PermissionGrantsFields"
import { PermissionGroupFields } from "@/components/branches/PermissionGroupFields"
import type { PermissionGroupFieldsProps } from "@/components/branches/PermissionGroupFields"

/** One choice of a list, already worded. */
interface ChoiceView {
    readonly id: string
    readonly label: string
}

/** What the form edits about one rule, as typed (a number field is NaN while empty). */
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

/** Every word of the form, already resolved: its own and those of the three field groups. */
type FormCopy = PermissionBandsFieldsProps["props"]["copy"] &
    PermissionGroupFieldsProps["props"]["copy"] &
    PermissionGrantsFieldsProps["props"]["copy"] & {
        readonly agentsLabel: string
        readonly agentsHint: string
        readonly strategyLabel: string
        readonly save: string
        readonly cancel: string
    }

/** The words and state of the rule form. */
export interface PermissionRuleFormProps {
    readonly shape: { readonly grants: ReactNode }
    readonly props: {
        /** The rule being changed, already worded: the action and the department. */
        readonly title: string
        readonly draft: DraftView
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
        readonly copy: FormCopy
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

/** What the asked fields draw: the form's props and the approval limits, drawn by the block. */
interface AskedFieldsProps {
    readonly props: PermissionRuleFormProps["props"]
    readonly on: PermissionRuleFormProps["on"]
    readonly grants: ReactNode
}

/** The approver group, how they decide and the approval limits: what a rule that asks a person needs. */
const AskedFields = (props: AskedFieldsProps) => {
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
            {props.grants}
        </>
    )
}

/** What the foot of the form needs. */
interface FormFootProps {
    readonly props: Pick<PermissionRuleFormProps["props"], "copy" | "isPending" | "canSave">
    readonly on: Pick<PermissionRuleFormProps["on"], "close" | "save">
}

/** The commands at the foot of the form card: leave it as it was, or save the rule. */
const FormFoot = (props: FormFootProps) => (
    <Cluster gap="inline" justify="end">
        <Button intent="dismiss" isDisabled={props.props.isPending} onPress={props.on.close}>
            {props.props.copy.cancel}
        </Button>
        <Button
            intent="commit"
            isPending={props.props.isPending}
            isDisabled={!props.props.canSave}
            onPress={props.on.save}
        >
            {props.props.copy.save}
        </Button>
    </Cluster>
)

/** The form that sets how far one rule lets an agent go and who approves the rest, with its save command at the foot. */
export const PermissionRuleForm = (props: PermissionRuleFormProps) => {
    const { props: p, on } = props
    const draft = p.draft
    const asks = draft.strategy === "bands" || draft.strategy === "ask"
    return (
        <SurfaceCard
            ariaLabel={p.title}
            footers={[{ kind: "custom", children: <FormFoot props={p} on={on} /> }]}
        >
            <Stack gap="section">
            <CheckboxGroup
                label={p.copy.agentsLabel}
                description={p.copy.agentsHint}
                options={optionsOf(p.agentOptions)}
                value={draft.agents}
                onValueChange={on.agents}
            />
            <ChoiceChips
                label={p.copy.strategyLabel}
                width="fill"
                empty={p.copy.strategyLabel}
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
            {asks ? <AskedFields props={p} on={on} grants={props.shape.grants} /> : null}
            </Stack>
        </SurfaceCard>
    )
}
