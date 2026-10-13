/** What SePay counts as a delivered webhook: HTTP 200 or 201 with `{"success": true}`. */
export class SepayAck {
    /** Always true: SePay retries every other answer. */
    success!: true
}
