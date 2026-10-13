import { PageContainer, Text, TopBar } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AdminNavigation } from "@/components/blocks/AdminNavigation"
import { PAGE_CLASS_NAME } from "./classNames"

/** The words and the signed-in admin the console frame draws. */
export interface AdminLayoutBaseProps {
    readonly props: {
        readonly title: string
        readonly email: string
    }
    readonly children: ReactNode
}

/** Draws the team console frame: the top bar with brand, destinations and who is signed in, then the routed page. */
export const AdminLayoutBase = (props: AdminLayoutBaseProps) => (
    <>
        <TopBar
            position="static"
            brand={<Text weight="semibold">{props.props.title}</Text>}
            navigation={<AdminNavigation />}
            actions={
                <Text size="sm" tone="muted">
                    {props.props.email}
                </Text>
            }
        />
        <PageContainer measure="full">
            <div className={PAGE_CLASS_NAME}>{props.children}</div>
        </PageContainer>
    </>
)
