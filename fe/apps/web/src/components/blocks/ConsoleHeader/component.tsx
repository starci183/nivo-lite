import { Badge, Button, DropdownMenu, SearchField, TopBar } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import type { ConsolePending } from "@/modules/types"
import { ConsoleAccountMenu } from "../../composites/ConsoleAccountMenu"
import { ConsoleNotifications } from "../../composites/ConsoleNotifications"
import { ConsoleWorkspaceMenu } from "../../composites/ConsoleWorkspaceMenu"
import { FoundingBadge } from "../../composites/FoundingBadge"
import { LocaleSegments } from "../../composites/LocaleSegments"
import { NivoLogo } from "../../leaves/NivoLogo"
import { ACTIONS, BADGE, BRAND, SEARCH, WORKSPACE_NAME } from "./classNames"

/** Everything the console top bar draws, resolved by the connected block. */
export interface ConsoleHeaderBaseProps {
    readonly props: {
        readonly logoLabel: string
        readonly workspaceName: string
        readonly userName: string
        readonly avatarUrl?: string
        readonly roleLabel: string
        readonly isStaff: boolean
        readonly isFoundingMember: boolean
        readonly foundingLabel: string
        readonly workspaceEntries: ReadonlyArray<DropdownMenuEntry>
        readonly accountEntries: ReadonlyArray<DropdownMenuEntry>
        readonly newEntries: ReadonlyArray<DropdownMenuEntry>
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly query: string
        readonly newLabel: string
        readonly languageLabel: string
        readonly locale: string
        readonly isLocalePending: boolean
        readonly localeOptions: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
        readonly pending: ReadonlyArray<ConsolePending>
        readonly pendingCount: number
        readonly isNotificationsOpen: boolean
        readonly notificationsCopy: {
            readonly bell: string
            readonly title: string
            readonly nothingWaiting: string
            readonly openOffice: string
        }
    }
    readonly on: {
        readonly setQuery: (query: string) => void
        readonly search: (query: string) => void
        readonly chooseLocale: (locale: string) => void
        readonly setNotificationsOpen: (isOpen: boolean) => void
        readonly openOffice: () => void
    }
}

type PartProps = ConsoleHeaderBaseProps

const Brand = ({ props }: PartProps) => (
    <div className={BRAND}>
        <NivoLogo variant="mark" height={28} label={props.logoLabel} />
        <div className={WORKSPACE_NAME}>
            <ConsoleWorkspaceMenu workspaceName={props.workspaceName} entries={props.workspaceEntries} />
        </div>
        <Badge tone={props.isStaff ? "neutral" : "accent"}>{props.roleLabel}</Badge>
        <div className={BADGE}>
            <FoundingBadge isFoundingMember={props.isFoundingMember} label={props.foundingLabel} />
        </div>
    </div>
)

const Actions = ({ props, on }: PartProps) => (
    <div className={ACTIONS}>
        <div className={SEARCH}>
            <SearchField
                label={props.searchLabel}
                isLabelHidden
                placeholder={props.searchPlaceholder}
                value={props.query}
                onValueChange={on.setQuery}
                onClear={() => on.setQuery("")}
                onSubmit={(value) => {
                    const text = value.trim()
                    if (text.length > 0) on.search(text)
                }}
            />
        </div>
        <DropdownMenu
            placement="bottom end"
            entries={props.newEntries}
            trigger={
                <Button variant="secondary" size="sm">
                    {props.newLabel}
                </Button>
            }
        />
        <LocaleSegments
            label={props.languageLabel}
            value={props.locale}
            options={props.localeOptions}
            isDisabled={props.isLocalePending}
            onChange={on.chooseLocale}
        />
        <ConsoleNotifications
            count={Math.max(props.pendingCount, 0)}
            pending={props.pending}
            copy={props.notificationsCopy}
            isOpen={props.isNotificationsOpen}
            onOpenChange={on.setNotificationsOpen}
            onOpenOffice={on.openOffice}
        />
        <ConsoleAccountMenu userName={props.userName} avatarUrl={props.avatarUrl} entries={props.accountEntries} />
    </div>
)

/** Draws the console top bar: brand and workspace on the left; search, New, language, bell and account on the right. */
export const ConsoleHeaderBase = (props: ConsoleHeaderBaseProps) => (
    <TopBar position="sticky" brand={<Brand {...props} />} actions={<Actions {...props} />} />
)
