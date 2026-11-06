import { Badge, DropdownMenu, IconButton } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { PaneHead } from "@/components/composites/PaneHead"
import type { PanePrimary } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"

/** What the head band of the opened responsibility draws and asks. */
interface ResponsibilityMainHeadProps {
    readonly title: string
    /** "Customer - company". */
    readonly customer: string
    readonly statusLabel: string
    readonly isWaitingApproval: boolean
    readonly isLoading: boolean
    readonly backLabel: string
    readonly onBack: () => void
    readonly moreLabel: string
    /** Where the customer of the responsibility is. */
    readonly leadHref: string
    /** Where the Office is. */
    readonly officeHref: string
    readonly labels: { readonly openLead: string; readonly openOffice: string; readonly copyLink: string }
    readonly onCopy: () => void
    /** The one filled command: the follow-up draft, when one can be asked for. */
    readonly primary: PanePrimary | undefined
}

/** The commands beyond the draft: the lead, the Office and the copied link. */
const entriesOf = (props: ResponsibilityMainHeadProps): DropdownMenuEntry[] => [
    { id: "lead", label: props.labels.openLead, href: props.leadHref },
    { id: "office", label: props.labels.openOffice, href: props.officeHref },
    { id: "copy", label: props.labels.copyLink, onAction: props.onCopy },
]

/** The head band of the opened responsibility: what it is and where it stands, its other commands, and the draft command. */
export const ResponsibilityMainHead = (props: ResponsibilityMainHeadProps) => (
    <PaneHead
        title={props.title}
        headingLevel={1}
        description={props.customer}
        mark={<PersonAvatar name={props.customer.split(" · ")[0] ?? ""} size="sm" />}
        status={<Badge tone={props.isWaitingApproval ? "warning" : "neutral"}>{props.statusLabel}</Badge>}
        isLoading={props.isLoading}
        back={{ label: props.backLabel, onPress: props.onBack }}
        actions={
            <DropdownMenu
                placement="bottom end"
                entries={entriesOf(props)}
                trigger={
                    <IconButton intent="neutral" source={nivoIconSource("more", "leading")} label={props.moreLabel} />
                }
            />
        }
        {...(props.primary === undefined ? {} : { primary: props.primary })}
    />
)
