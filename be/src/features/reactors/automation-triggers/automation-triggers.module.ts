import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./automation-triggers.module-definition"
import { ReactToLeadCapturedHandler } from "./application/react-to-lead-captured.handler"
import { ReactToDealWonHandler } from "./application/react-to-deal-won.handler"
import { ReactToDecisionMadeHandler } from "./application/react-to-decision-made.handler"
import { ReactToPaymentReconciledHandler } from "./application/react-to-payment-reconciled.handler"
import { ReactToOrderConfirmedHandler } from "./application/react-to-order-confirmed.handler"
import { ReactToOrderShippedHandler } from "./application/react-to-order-shipped.handler"

@Module({
    providers: [
        ReactToLeadCapturedHandler,
        ReactToDealWonHandler,
        ReactToDecisionMadeHandler,
        ReactToPaymentReconciledHandler,
        ReactToOrderConfirmedHandler,
        ReactToOrderShippedHandler,
    ],
})
/** The automation-triggers reactor: the handlers its consumers dispatch to. */
export class AutomationTriggersModule extends ConfigurableModuleClass {}
