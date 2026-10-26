import { Badge, Button, ListRow, Text } from "@starci/grammar/common"

interface CreditsListRowProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly badge: string
        readonly badgeTone: "success" | "neutral"
        readonly isSkeleton: boolean
        readonly purchase?:
            { readonly label: string; readonly pending: boolean; readonly disabled: boolean } | undefined
    }
    readonly on?: { readonly purchase: () => void }
}

/** A reusable credit pack or plan row with settled copy and optional purchase action. */
export const CreditsListRow = (props: CreditsListRowProps) => {
    const row = props.props
    return (
        <ListRow
            title={<Text isSkeleton={row.isSkeleton}>{row.title}</Text>}
            description={
                <Text size="sm" isSkeleton={row.isSkeleton}>
                    {row.description}
                </Text>
            }
            badges={row.badge ? <Badge tone={row.badgeTone}>{row.badge}</Badge> : undefined}
            actions={
                row.purchase ? (
                    <Button
                        intent="alternative"
                        size="sm"
                        isPending={row.purchase.pending}
                        isDisabled={row.purchase.disabled}
                        isSkeleton={row.isSkeleton}
                        {...(props.on?.purchase !== undefined && { onPress: props.on.purchase })}
                    >
                        {row.purchase.label}
                    </Button>
                ) : undefined
            }
        />
    )
}
