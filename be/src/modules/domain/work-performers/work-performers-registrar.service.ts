import { Injectable, type OnModuleInit } from "@nestjs/common"
import { InjectWorkPerformerRegistry, type WorkPerformerRegistry } from "@modules/domain/decisions"
import { BOOKING_ACTIONS, BookingPerformerService } from "./booking-performer.service"
import { BookingRemindPerformerService } from "./booking-remind-performer.service"
import { GatewayCallPerformerService } from "./gateway-call-performer.service"
import { ResumeRunPerformerService } from "./resume-run-performer.service"
import { ReplyCustomerPerformerService } from "./reply-customer-performer.service"
import { SendEmailPerformerService } from "./send-email-performer.service"

@Injectable()
/** Registers the performer of each action with the work engine at boot; an action without one only records its decision. */
export class WorkPerformersRegistrarService implements OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly reply: ReplyCustomerPerformerService,
        private readonly email: SendEmailPerformerService,
        private readonly booking: BookingPerformerService,
        private readonly remind: BookingRemindPerformerService,
        private readonly gatewayCall: GatewayCallPerformerService,
        private readonly resumeRun: ResumeRunPerformerService,
    ) {}

    /** Adds the performers to the registry: the customer reply, the email, the booking actions and the gateway calls. */
    onModuleInit(): void {
        this.registry.add("reply_customer", this.reply)
        this.registry.add("send_email", this.email)
        for (const action of BOOKING_ACTIONS) this.registry.add(action, this.booking)
        this.registry.add("remind_booking", this.remind)
        this.registry.add("gateway_call", this.gatewayCall)
        this.registry.add("review_agent_run", this.resumeRun)
    }
}
