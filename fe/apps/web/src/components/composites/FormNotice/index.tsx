import { Alert } from "@starci/grammar/common"

/** What a form tells the person after a try. */
type FormNoticeProps = {
    /** Title of the negative alert. */
    readonly failTitle: string
    /** The failure text; nothing is drawn for it while undefined. */
    readonly error?: string | undefined
    /** The success text; nothing is drawn for it while undefined. */
    readonly done?: string | undefined
}

/** The one failure or success alert under a form. */
export const FormNotice = (props: FormNoticeProps) => {
    if (props.error !== undefined) return <Alert tone="negative" title={props.failTitle} description={props.error} />
    if (props.done !== undefined) return <Alert tone="affirmative" title={props.done} />
    return null
}
