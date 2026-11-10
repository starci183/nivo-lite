import {
    type DropdownMenuEntry,
    type DropdownMenuItem,
    AvatarButton,
    Cluster,
    DropdownMenu,
    IconButton,
    TopBar,
    Switch,
    useTopBarOverflowEntries,
} from "@starci/grammar/common"
import { ACCOUNT_ITEM, SIGN_OUT_ITEM } from "@/modules/types"
import { ConsoleWorkspaceMenu } from "../../composites/ConsoleWorkspaceMenu"
import { FoundingBadge } from "../../composites/FoundingBadge"
import { languageMenuEntries } from "../../composites/LanguageMenu"
import { nivoIconSource } from "../../leaves/Icon"
import { BADGE, SWITCHES } from "./classNames"

/** Everything the console top bar draws, resolved by the connected block. */
export interface ConsoleHeaderBaseProps {
    readonly props: {
        readonly workspaceName: string
        readonly actionsLabel: string
        /** The workspace logo (brand kit), shown in the lockup; null shows the monogram. */
        readonly workspaceLogoUrl: string | null
        readonly userName: string
        readonly userId: string
        readonly avatarUrl?: string | undefined
        readonly roleLabel: string
        readonly isFoundingMember: boolean
        readonly foundingLabel: string
        readonly workspaceEntries: ReadonlyArray<DropdownMenuEntry>
        readonly accountEntries: ReadonlyArray<DropdownMenuEntry>
        readonly languageLabel: string
        readonly locale: string
        readonly isLocalePending: boolean
        readonly localeOptions: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
        readonly themeLabel: string
        readonly guideBubbleLabel: string
        readonly guideBubbleDescription: string
        readonly isGuideBubbleShown: boolean
        readonly isDark: boolean
        readonly bellLabel: string
        readonly bellHref: string
        readonly hasWaiting: boolean
    }
    readonly on: {
        readonly chooseLocale: (locale: string) => void
        readonly chooseDark: (isDark: boolean) => void
        readonly chooseGuideBubble: (shown: boolean) => void
    }
}

type BrandProps = Pick<ConsoleHeaderBaseProps, "props">

const Brand = ({ props }: BrandProps) => (
    <Cluster gap="inline" wrap={false}>
        <ConsoleWorkspaceMenu
            workspaceName={props.workspaceName}
            logoUrl={props.workspaceLogoUrl}
            roleLabel={props.roleLabel}
            entries={props.workspaceEntries}
        />
        <div className={BADGE}>
            <FoundingBadge isFoundingMember={props.isFoundingMember} label={props.foundingLabel} />
        </div>
    </Cluster>
)

const GUIDE_BUBBLE_ITEM = "guide-bubble-shown"

/** The glyph and tone of the account menu's two commands, keyed by the ids `modules/types` shares with the entries builder. */
const COMMAND_LOOKS: Record<
    string,
    { readonly iconSource: ReturnType<typeof nivoIconSource>; readonly tone?: "danger" }
> = {
    [ACCOUNT_ITEM]: { iconSource: nivoIconSource("account", "leading") },
    [SIGN_OUT_ITEM]: { iconSource: nivoIconSource("signOut", "leading"), tone: "danger" },
}

/** Gives a known command its glyph without keeping an identity mark in the same slot. */
const withCommandLook = (item: DropdownMenuItem): DropdownMenuItem => {
    const look = COMMAND_LOOKS[item.id]
    if (look === undefined) return item
    const { mark: _mark, ...command } = item
    return { ...command, ...look }
}

/** Gives the account page and sign-out items their leading glyph (sign out marked destructive). */
const withLooks = (entries: ReadonlyArray<DropdownMenuEntry>): ReadonlyArray<DropdownMenuEntry> =>
    entries.map((entry) =>
        entry.kind === "section"
            ? { ...entry, items: entry.items.map((item) => withCommandLook(item)) }
            : withCommandLook(entry),
    )

/** The assistant toggle: a one-item checkable section (Grammar's menu has no switch entry), hidden until the member checks it. */
const guideBubbleSection = ({ props, on }: ConsoleHeaderBaseProps): DropdownMenuEntry => ({
    kind: "section",
    id: "guide-bubble",
    items: [{ id: GUIDE_BUBBLE_ITEM, label: props.guideBubbleLabel, description: props.guideBubbleDescription }],
    selection: {
        mode: "multiple",
        selectedIds: props.isGuideBubbleShown ? [GUIDE_BUBBLE_ITEM] : [],
        onChange: (ids) => on.chooseGuideBubble(ids.includes(GUIDE_BUBBLE_ITEM)),
    },
})

const Actions = ({ props, on }: ConsoleHeaderBaseProps) => {
    const overflow = useTopBarOverflowEntries()
    return (
        <Cluster gap="inline" wrap={false} justify="end">
            <div className={SWITCHES}>
                <Cluster gap="inline" wrap={false}>
                    <DropdownMenu
                        placement="bottom end"
                        entries={languageMenuEntries({
                            label: props.languageLabel,
                            value: props.locale,
                            options: props.localeOptions,
                            isDisabled: props.isLocalePending,
                            onChange: on.chooseLocale,
                        })}
                        trigger={
                            <IconButton
                                source={nivoIconSource("locale", "leading")}
                                label={props.languageLabel}
                                intent="dismiss"
                                isDisabled={props.isLocalePending}
                            />
                        }
                    />
                    <Switch
                        label={props.themeLabel}
                        isLabelHidden
                        size="control"
                        isSelected={props.isDark}
                        onSelectedChange={on.chooseDark}
                        thumbIcon={nivoIconSource("light", "leading")}
                        selectedThumbIcon={nivoIconSource("dark", "leading")}
                    />
                </Cluster>
            </div>
            <DropdownMenu
                placement="bottom end"
                entries={[...withLooks(props.accountEntries), guideBubbleSection({ props, on }), ...overflow]}
                trigger={
                    <AvatarButton
                        size="control"
                        name={props.userName}
                        seed={props.userId}
                        {...(props.avatarUrl ? { src: props.avatarUrl } : {})}
                    />
                }
            />
        </Cluster>
    )
}

/** Draws the console top bar: the workspace lockup on the left; language, appearance, bell and account on the right; the compact tab row under it. */
export const ConsoleHeaderBase = (props: ConsoleHeaderBaseProps) => (
    <TopBar
        position="sticky"
        brand={<Brand {...props} />}
        actions={<Actions {...props} />}
        customButtons={[
            {
                id: "notifications",
                glyph: "bell",
                label: props.props.bellLabel,
                href: props.props.bellHref,
                badge: props.props.hasWaiting,
            },
        ]}
    />
)
