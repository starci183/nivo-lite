import { Button, Text, Badge, type BadgeTone } from "@starci/grammar/common";




/** Resolved customer-safe capability with one action. */
export type StatusActionCardData = {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly actionLabel: string
    readonly disabled?: boolean
    readonly isPending?: boolean
    readonly detail?: string
    readonly actionHref?: string
    readonly actionTarget?: "_blank" | "_self"
}
/** Action reported by the capability card. */
export type StatusActionCardActions = { readonly press?: () => void }
/** Props for one capability card. */
export type StatusActionCardProps = { readonly props: StatusActionCardData; readonly on?: StatusActionCardActions; readonly isLoading?: boolean }

/** Render one capability with status and one safe action. */
export const StatusActionCard = (props: StatusActionCardProps) => (
    <div>
        <div>
            <Text weight="semibold" isSkeleton={props.isLoading}>{props.props.title}</Text>
            <Text size="xs" tone="muted" isSkeleton={props.isLoading}>{props.props.description}</Text>
        </div>
        <Badge tone={props.props.statusTone} isSkeleton={props.isLoading}>{props.props.statusLabel}</Badge>
        {props.props.detail === undefined ? null : <Text size="sm" tone="muted">{props.props.detail}</Text>}
        {props.props.actionHref !== undefined && props.props.disabled !== true ? (
            <Button href={props.props.actionHref} target={props.props.actionTarget} onFollow={props.on?.press}>{props.props.actionLabel}</Button>
        ) : (
            <Button isDisabled={props.props.disabled} isPending={props.props.isPending} isSkeleton={props.isLoading} onPress={props.on?.press}>{props.props.actionLabel}</Button>
        )}
    </div>
)
