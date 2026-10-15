import type { ReactNode } from "react"
import { Badge, Icon, IconTile, Link, Switch, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"
import { ACTIONS_CLASS, CARD_FOOT_CLASS, CARD_STACK_CLASS, CARD_TEXT_CLASS, CARD_TOP_CLASS } from "./classNames"

/** The icon word of a template. */
type AutomationIconWord =
    | "payment"
    | "leads"
    | "report"
    | "review"
    | "debt"
    | "winback"
    | "moon"
    | "sheet"
    | "calendar"
    | "cart"
    | "contract"
    | "truck"
    | "receipt"
    | "ledger"

/** Template icon word -> the app glyph names. */
const ICONS: Record<AutomationIconWord, IconName> = {
    payment: "wallet",
    leads: "account",
    report: "overview",
    review: "review",
    debt: "credit",
    winback: "retry",
    moon: "dark",
    sheet: "blog",
    calendar: "streak",
    cart: "cart",
    contract: "saved",
    truck: "servers",
    receipt: "wallet",
    ledger: "saved",
}

/** The tone of a status badge. */
type CardTone = "success" | "neutral" | "warning" | "danger"

/** The one line under the card text: why the switch cannot be pressed, or the one thing to fix. */
type AutomationCardNote = {
    readonly text: string
    /** Where the owner fixes it, with the words of the link. */
    readonly link?: { readonly href: string; readonly label: string }
}

/** What one automation card shows, already in the reader language. */
type AutomationCardProps = {
    readonly name: string
    readonly description: string
    readonly triggerLine: string
    readonly statusLabel: string
    readonly statusTone: CardTone
    readonly icon: AutomationIconWord
    readonly note?: AutomationCardNote
    readonly sheet?: { readonly href: string; readonly label: string }
    readonly selectLabel: string
    readonly switchLabel: string
    readonly switchName: string
    readonly isSelected: boolean
    readonly isEnabled: boolean
    readonly isSwitchDisabled: boolean
    /** The card sits inside another bounded surface: outline instead of elevation. */
    readonly isNested: boolean
    readonly dataKey: string
    readonly onSelect: () => void
    readonly onToggle: (next: boolean) => void
    /** Extra controls under the card text (the Google account picker of a Sheets automation). */
    readonly children?: ReactNode
}

/**
 * One automation as one SurfaceCard: neutral icon tile, name, status, what it is, what starts it, and its switch. "Select" opens the
 * detail (the switch is a separate, disjoint control); the selected card carries the one accent sweep.
 */
export const AutomationCard = (props: AutomationCardProps) => (
    <SurfaceCard ariaLabel={props.name} depth={props.isNested ? "nested" : "top"} isHighlight={props.isSelected}>
        <div className={CARD_STACK_CLASS} data-automation={props.dataKey}>
            <div className={CARD_TOP_CLASS}>
                <IconTile source={nivoIconSource(ICONS[props.icon] ?? "apps", "leading")} tone="neutral" />
                <div className={CARD_TEXT_CLASS}>
                    <Text weight="semibold">{props.name}</Text>
                    <div className={ACTIONS_CLASS}>
                        <Badge isDot tone={props.statusTone}>
                            {props.statusLabel}
                        </Badge>
                    </div>
                </div>
            </div>
            <Text size="sm" tone="muted">
                {props.description}
            </Text>
            <Text
                size="xs"
                tone="muted"
                startContent={<Icon source={nivoIconSource("trigger", "chip")} usage="chip" />}
            >
                {props.triggerLine}
            </Text>
            {props.note === undefined ? null : (
                <Text size="xs" tone="muted">
                    {props.note.text}
                    {props.note.link === undefined ? null : (
                        <>
                            {" "}
                            <Link href={props.note.link.href}>{props.note.link.label}</Link>
                        </>
                    )}
                </Text>
            )}
            {props.sheet === undefined ? null : (
                <Text size="xs">
                    <Link href={props.sheet.href} kind="external">
                        {props.sheet.label}
                    </Link>
                </Text>
            )}
            {props.children}
            <div className={CARD_FOOT_CLASS}>
                <TextAction appearance="disclosure" size="sm" isCurrent={props.isSelected} onPress={props.onSelect}>
                    {props.selectLabel}
                </TextAction>
                <Switch
                    name={props.switchName}
                    label={props.switchLabel}
                    isSelected={props.isEnabled}
                    isDisabled={props.isSwitchDisabled}
                    onSelectedChange={props.onToggle}
                />
            </div>
        </div>
    </SurfaceCard>
)

/** What one skeleton card shows. */
type AutomationCardSkeletonProps = {
    readonly loadingLabel: string
    readonly statusLabel: string
    readonly selectLabel: string
    readonly isNested: boolean
}

/** One automation card while the collection loads: the resolved card's anatomy as inert geometry. */
export const AutomationCardSkeleton = (props: AutomationCardSkeletonProps) => (
    <SurfaceCard ariaLabel={props.loadingLabel} depth={props.isNested ? "nested" : "top"}>
        <div className={CARD_STACK_CLASS} aria-busy="true">
            <div className={CARD_TOP_CLASS}>
                <IconTile source={nivoIconSource("trigger", "leading")} tone="neutral" isSkeleton />
                <div className={CARD_TEXT_CLASS}>
                    <Text weight="semibold" isSkeleton>
                        {props.loadingLabel}
                    </Text>
                    <div className={ACTIONS_CLASS}>
                        <Badge isDot tone="neutral" isSkeleton>
                            {props.statusLabel}
                        </Badge>
                    </div>
                </div>
            </div>
            <Text size="sm" tone="muted" isSkeleton>
                {props.loadingLabel}
            </Text>
            <Text size="xs" tone="muted" isSkeleton>
                {props.loadingLabel}
            </Text>
            <div className={CARD_FOOT_CLASS}>
                <TextAction appearance="disclosure" size="sm" isSkeleton>
                    {props.selectLabel}
                </TextAction>
            </div>
        </div>
    </SurfaceCard>
)
