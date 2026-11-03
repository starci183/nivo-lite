/** Log events of the orders capability. */
export enum OrdersLogEvent {
    /** The bank-feed connections could not be told that a payment is awaited; the order or claim stands and the normal polling finds the money. */
    PaymentDemandFailed = "orders.payment_demand_failed",
}
