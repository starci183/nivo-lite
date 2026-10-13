import { Badge, DescriptionList, PageContainer, SurfaceCard } from "@starci/grammar/common"
import { AccountEmail } from "@/components/blocks/AccountEmail"
import { AccountPassword } from "@/components/blocks/AccountPassword"
import { AccountProfile } from "@/components/blocks/AccountProfile"
import { AccountSessions } from "@/components/blocks/AccountSessions"
import { PageHeading } from "@/components/composites/PageHeading"
import type { SessionRowView } from "@/hooks/account"
import { APP_ROUTES } from "@/modules/routes"
import { PAGE_CLASS_NAME } from "./classNames"

/** One sign-in method and whether the account has it linked. */
interface MethodView {
    readonly id: string
    readonly label: string
    readonly isLinked: boolean
}

/** Copy and values the account page supplies. */
export interface AccountPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly methodsTitle: string
        readonly linkedLabel: string
        readonly notLinkedLabel: string
        readonly name: string
        readonly email: string
        readonly methods: ReadonlyArray<MethodView>
        readonly sessions: ReadonlyArray<SessionRowView>
        readonly sessionsFailed: boolean
        /** The same page while its data loads: labels stay, values and device rows are skeletons. */
        readonly isLoading: boolean
    }
}

/** Draws the account screen: profile, email, password, sign-in methods and device sessions. */
export const AccountPageBase = (props: AccountPageBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            <PageHeading
                crumbLabel={props.props.crumbLabel}
                crumbs={[
                    { id: "home", label: props.props.crumbHome, href: APP_ROUTES.dashboard },
                    { id: "account", label: props.props.title },
                ]}
                eyebrow={props.props.eyebrow}
                title={props.props.title}
                description={props.props.description}
            />
            <AccountProfile name={props.props.name} isLoading={props.props.isLoading} />
            <AccountEmail email={props.props.email} isLoading={props.props.isLoading} />
            <AccountPassword isLoading={props.props.isLoading} />
            <SurfaceCard label={props.props.methodsTitle} headingLevel={2}>
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
            <AccountSessions
                rows={props.props.sessions}
                isFailed={props.props.sessionsFailed}
                isLoading={props.props.isLoading}
            />
        </div>
    </PageContainer>
)
