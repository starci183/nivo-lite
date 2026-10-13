import { Alert } from "@starci/grammar/common"

/** The one error line and the one notice line a form can show. */
interface InventoryNoticesProps {
    readonly error: string | null
    readonly notice?: string | null
}

/** The failure sentence and the success sentence of the last command, each only when there is one. */
export const InventoryNotices = (props: InventoryNoticesProps) => (
    <>
        {props.error === null ? null : <Alert tone="negative" title={props.error} />}
        {props.notice === undefined || props.notice === null ? null : <Alert tone="affirmative" title={props.notice} />}
    </>
)
