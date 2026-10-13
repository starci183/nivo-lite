/** Operational events of the loyalty capability. */
export enum LoyaltyLogEvent {
    /** Delivery failed; the issued code is discarded without disclosing membership to the visitor. */
    CodeDeliveryFailed = "loyalty.code.delivery-failed",
}
