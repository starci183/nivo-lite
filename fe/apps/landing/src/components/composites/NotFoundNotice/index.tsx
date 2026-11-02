import { Heading, Link } from "@starci/grammar/common"

/** The words of a missing page and the way home. */
type NotFoundNoticeProps = {
    readonly title: string
    readonly homeLabel: string
    readonly homeHref: string
}

/** A missing page with one destination back to the app's front door. */
export const NotFoundNotice = (props: NotFoundNoticeProps) => (
    <>
        <Heading level={1}>{props.title}</Heading>
        <Link href={props.homeHref}>{props.homeLabel}</Link>
    </>
)
