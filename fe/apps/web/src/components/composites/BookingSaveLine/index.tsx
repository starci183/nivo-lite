import { Alert, Button } from "@starci/grammar/common"

/** What the save line of a setup form draws. */
type BookingSaveLineProps = {
    readonly label: string
    readonly isPending: boolean
    readonly notice?: { readonly tone: "affirmative" | "negative"; readonly text: string }
}

/** The line that closes a setup form: its submit button and, once pressed, whether it worked. */
export const BookingSaveLine = (props: BookingSaveLineProps) => (
    <>
        <div>
            <Button type="submit" intent="commit" size="sm" isPending={props.isPending}>
                {props.label}
            </Button>
        </div>
        {props.notice === undefined ? null : <Alert tone={props.notice.tone} title={props.notice.text} />}
    </>
)
