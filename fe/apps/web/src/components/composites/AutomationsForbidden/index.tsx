import { Button, PageContainer, SectionHeader } from "@starci/grammar/common"
import { LINK_ROW_CLASS, PAGE_CLASS } from "./classNames"

/** What the friendly 403 says, already in the reader language. */
type AutomationsForbiddenProps = {
    readonly title: string
    readonly body: string
    readonly backLabel: string
    readonly backHref: string
    /** `bare` draws only the content, for a board that already sits inside a page container. */
    readonly bare?: boolean
}

/** The friendly 403 staff see instead of the automations board. */
export const AutomationsForbidden = (props: AutomationsForbiddenProps) => {
    const content = (
        <div className={PAGE_CLASS}>
            <SectionHeader level={1} title={props.title} description={props.body} />
            <div className={LINK_ROW_CLASS}>
                <Button intent="neutral" href={props.backHref}>
                    {props.backLabel}
                </Button>
            </div>
        </div>
    )
    return props.bare ? content : <PageContainer measure="product">{content}</PageContainer>
}
