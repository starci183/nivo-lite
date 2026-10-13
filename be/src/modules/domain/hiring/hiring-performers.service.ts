import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { ActionPerformerRegistry } from "@modules/domain/module-ops"
import { HiringInterviewsService } from "./hiring-interviews.service"
import { HiringOffersService } from "./hiring-offers.service"
import { HiringScreeningService } from "./hiring-screening.service"

@Injectable()
/** Registers what runs once the gate lets a hiring action through: screening a candidate, inviting to an interview, sending an offer. */
export class HiringPerformersService implements OnModuleInit {
    constructor(
        private readonly registry: ActionPerformerRegistry,
        private readonly screening: HiringScreeningService,
        private readonly interviews: HiringInterviewsService,
        private readonly offers: HiringOffersService,
    ) {}

    /** Hands the three performers to the registry. */
    onModuleInit(): void {
        this.registry.add({ action: "screen_candidate", perform: (context) => this.screening.perform(context) })
        this.registry.add({ action: "schedule_interview", perform: (context) => this.interviews.perform(context) })
        this.registry.add({
            action: "send_offer",
            perform: (context) => this.offers.perform(context),
            reject: (context) => this.offers.reject(context),
        })
    }
}
