import { DropdownMenu, IconButton } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** What the menu of one lead row offers. */
type LeadRowMenuProps = {
    readonly leadId: string
    readonly href: string
    readonly officeHref: string
    readonly canPropose: boolean
    readonly isDisabled: boolean
    readonly openLabel: string
    readonly officeLabel: string
    readonly proposeLabel: string
    readonly moreLabel: string
    readonly onPropose: (leadId: string) => void
}

/** The menu at the end of a lead row: open the lead, ask in the Office, and propose an owner when there is none. */
export const LeadRowMenu = (props: LeadRowMenuProps) => {
    const open = { id: "open", label: props.openLabel, href: props.href }
    const office = { id: "office", label: props.officeLabel, href: props.officeHref }
    const propose = { id: "propose", label: props.proposeLabel, onAction: () => props.onPropose(props.leadId) }
    return (
        <DropdownMenu
            placement="bottom end"
            entries={props.canPropose ? [open, office, propose] : [open, office]}
            trigger={
                <IconButton
                    source={nivoIconSource("more", "leading")}
                    label={props.moreLabel}
                    isDisabled={props.isDisabled}
                />
            }
        />
    )
}
