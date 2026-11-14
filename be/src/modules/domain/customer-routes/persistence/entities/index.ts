import { CustomerMessageEntity } from "./customer-message.entity"
import { CustomerRouteEntity } from "./customer-route.entity"

export { CustomerMessageEntity, CustomerRouteEntity }
export type { CustomerMessageDirection, CustomerMessageFileValue } from "./customer-message.entity"

/** The entities the customer routes own, collected by the database module. */
export const customerRoutesEntities: readonly [typeof CustomerRouteEntity, typeof CustomerMessageEntity] = [
    CustomerRouteEntity,
    CustomerMessageEntity,
] as const
