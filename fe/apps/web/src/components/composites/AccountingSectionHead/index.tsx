import { SectionHeader, Tabs } from "@starci/grammar/common"
import { HEAD_CLASS_NAME } from "./classNames"

/** One choice of the section's peer selector. */
interface AccountingSectionChoice {
    readonly id: string
    readonly label: string
}

/** A section heading with a peer choice (a period, a type) on its right. */
interface AccountingSectionHeadProps {
    readonly title: string
    readonly intro: string
    readonly choiceLabel: string
    readonly choices: ReadonlyArray<AccountingSectionChoice>
    readonly selectedChoice: string
    readonly onChoose: (id: string) => void
}

/** The heading line of a section: title and intro, with the choice that changes what the section shows. */
export const AccountingSectionHead = (props: AccountingSectionHeadProps) => (
    <div className={HEAD_CLASS_NAME}>
        <SectionHeader level={2} title={props.title} description={props.intro} />
        <Tabs
            variant="secondary"
            label={props.choiceLabel}
            selectedKey={props.selectedChoice}
            inset="none"
            labelVisibility="always"
            items={props.choices}
            onSelect={props.onChoose}
        />
    </div>
)
