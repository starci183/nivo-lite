import { Badge, DescriptionList, SurfaceCard } from "@starci/grammar/common"
import type { MethodView } from "@/hooks/account"

/** Copy and values the connected sign-in methods card supplies. */
export interface AccountMethodsBaseProps {
    readonly props: {
        readonly title: string
        readonly linkedLabel: string
        readonly notLinkedLabel: string
        readonly methods: ReadonlyArray<MethodView>
        readonly isLoading: boolean
    }
}

/** Draws the sign-in methods card without reading copy, navigation or API state. */
export const AccountMethodsBase = (props: AccountMethodsBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <DescriptionList
            layout="columns"
            isLoading={props.props.isLoading}
            isDivided
            items={props.props.methods.map((method) => ({
                id: method.id,
                term: method.label,
                description: (
                    <Badge tone={method.isLinked ? "success" : "neutral"}>
                        {method.isLinked ? props.props.linkedLabel : props.props.notLinkedLabel}
                    </Badge>
                ),
            }))}
        />
    </SurfaceCard>
)
