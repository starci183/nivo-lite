import { CheckboxGroup, RadioGroup, Select, Text } from "@starci/grammar/common"
import { SECTION_CLASS_NAME } from "./classNames"

/** One choice of a list, already worded. */
interface ChoiceView {
    readonly id: string
    readonly label: string
}

const optionsOf = (choices: ReadonlyArray<ChoiceView>) => choices.map((one) => ({ value: one.id, label: one.label }))

/** The words and state of the approver fields. */
export interface PermissionGroupFieldsProps {
    readonly props: {
        readonly roles: ReadonlyArray<string>
        readonly rooms: ReadonlyArray<string>
        readonly members: ReadonlyArray<string>
        readonly policy: string
        readonly timeoutMinutes: number
        readonly roleOptions: ReadonlyArray<ChoiceView>
        readonly roomOptions: ReadonlyArray<ChoiceView>
        readonly memberOptions: ReadonlyArray<ChoiceView>
        readonly policyOptions: ReadonlyArray<ChoiceView>
        readonly timeoutOptions: ReadonlyArray<ChoiceView>
        readonly copy: {
            readonly groupLabel: string
            readonly rolesLabel: string
            readonly roomsLabel: string
            readonly roomsNone: string
            readonly membersLabel: string
            readonly membersHint: string
            readonly policyLabel: string
            readonly timeoutLabel: string
            readonly timeoutNote: string
        }
    }
    readonly on: {
        readonly roles: (ids: ReadonlyArray<string>) => void
        readonly rooms: (ids: ReadonlyArray<string>) => void
        readonly members: (ids: ReadonlyArray<string>) => void
        readonly policy: (value: string) => void
        readonly timeout: (value: string | null) => void
    }
}

/** Who approves (roles, rooms, named people), how they decide together and how long the request waits. */
export const PermissionGroupFields = (props: PermissionGroupFieldsProps) => {
    const { props: p, on } = props
    return (
        <>
            <div className={SECTION_CLASS_NAME}>
                <Text weight="semibold">{p.copy.groupLabel}</Text>
                <CheckboxGroup
                    label={p.copy.rolesLabel}
                    options={optionsOf(p.roleOptions)}
                    value={p.roles}
                    onValueChange={on.roles}
                />
                <CheckboxGroup
                    label={p.copy.roomsLabel}
                    description={p.roomOptions.length === 0 ? p.copy.roomsNone : undefined}
                    options={optionsOf(p.roomOptions)}
                    value={p.rooms}
                    onValueChange={on.rooms}
                />
                <CheckboxGroup
                    label={p.copy.membersLabel}
                    description={p.copy.membersHint}
                    options={optionsOf(p.memberOptions)}
                    value={p.members}
                    onValueChange={on.members}
                />
            </div>
            <RadioGroup
                label={p.copy.policyLabel}
                options={optionsOf(p.policyOptions)}
                value={p.policy}
                onValueChange={on.policy}
            />
            <Select
                label={p.copy.timeoutLabel}
                description={p.copy.timeoutNote}
                options={p.timeoutOptions}
                value={String(p.timeoutMinutes)}
                onValueChange={on.timeout}
            />
        </>
    )
}
