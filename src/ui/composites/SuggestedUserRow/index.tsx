import { Button, Text, TextAction, Badge } from "@starci/grammar/common";
import { Avatar } from "../../leaves/Avatar"




/** Resolved identity, qualification, and follow state for one suggested person. */
export type SuggestedUserRowData = {
    readonly id: string
    readonly name?: string
    readonly username?: string
    readonly avatar?: string
    readonly openToWork?: boolean
    readonly openToWorkLabel?: string
    readonly followLabel: string
    readonly followingLabel: string
    readonly isFollowing?: boolean
    readonly isPending?: boolean
}
/** Journeys reported by a suggested-person row. */
export type SuggestedUserRowActions = { readonly open?: () => void; readonly follow?: () => void }
/** Props for a suggested-person row. */
export type SuggestedUserRowProps = { readonly props: SuggestedUserRowData; readonly on?: SuggestedUserRowActions; readonly isLoading?: boolean }

/** Render one suggested identity with its optional badge and follow action. */
export const SuggestedUserRow = (props: SuggestedUserRowProps) => (
    <div>
        <Avatar props={{ name: props.props.name, src: props.props.avatar, size: "sm" }} isLoading={props.isLoading} />
        <div>
            <TextAction size="sm" isSkeleton={props.isLoading} onPress={props.on?.open}>{props.props.name ?? ""}</TextAction>
            <Text size="xs" tone="muted" isSkeleton={props.isLoading}>{props.props.username}</Text>
        </div>
        {props.props.openToWork === true ? <Badge tone="success">{props.props.openToWorkLabel}</Badge> : null}
        <Button variant="secondary" size="sm" isPending={props.props.isPending} isSkeleton={props.isLoading} onPress={props.props.isFollowing === true ? undefined : props.on?.follow}>{props.props.isFollowing === true ? props.props.followingLabel : props.props.followLabel}</Button>
    </div>
)
