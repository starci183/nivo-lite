/** The HTTP answer of request-loyalty-code. */
export class RequestLoyaltyCodeResponse {
    /** The ok. */
    ok!: boolean

    /** The code. */
    code!: "none" | "bad_phone" | "closed" | "busy" | "wrong"
}
