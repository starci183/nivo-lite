/** The HTTP answer of mark-no-show. */
export class MarkNoShowResponse {
    /** The status. */
    status!: "requested" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "done"

    /** The fee due. */
    feeDue!: boolean
}
