import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AccountingGateway } from "./accounting-gateway.port"

/** Token of the accounting gateway port; the app root binds it to the MCP gateway adapter. */
export const ACCOUNTING_GATEWAY: unique symbol = Symbol("domain.accounting.gateway")

/** Injects the accounting gateway. Parameter type: AccountingGateway. */
export const InjectAccountingGateway = (): TypedParameterDecorator<AccountingGateway> =>
    injector<AccountingGateway>(ACCOUNTING_GATEWAY)
