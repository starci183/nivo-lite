import { Heading, PageContainer, Text, WorkspaceShell } from "@starci/grammar/common"
import { PublicBookingForm } from "@/components/blocks/PublicBookingForm"
import type { PublicBookingPageData } from "@/modules/types"
import { HEAD_CLASS_NAME, MAIN_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** Props for {@link PublicBookingPageBase}. */
export interface PublicBookingPageBaseProps {
    readonly props: {
        readonly title: string
        readonly page: PublicBookingPageData
    }
}

/** Draws the public booking page: the shop, then the form. */
export const PublicBookingPageBase = (props: PublicBookingPageBaseProps) => {
    const { title, page } = props.props
    return (
        <WorkspaceShell
            align="stretch"
            primaryLabel={title}
            primary={
                <PageContainer measure="reading">
                    <div className={MAIN_CLASS_NAME}>
                        <div className={STACK_CLASS_NAME}>
                            <div className={HEAD_CLASS_NAME}>
                                <Heading level={1}>{title}</Heading>
                                <Text tone="muted">{page.shop}</Text>
                                {page.address === "" ? null : (
                                    <Text size="sm" tone="muted">
                                        {page.address}
                                    </Text>
                                )}
                                {page.note === "" ? null : <Text size="sm">{page.note}</Text>}
                            </div>
                            <PublicBookingForm page={page} />
                        </div>
                    </div>
                </PageContainer>
            }
        />
    )
}
