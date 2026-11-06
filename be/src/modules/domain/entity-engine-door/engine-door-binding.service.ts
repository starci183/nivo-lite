import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { ModuleJobRunnerService } from "@modules/domain/entity-engine"
import { EngineDoorService } from "./engine-door.service"

@Injectable()
/** Hands the door provider to the runner of declared jobs when the app boots, so a job that lists the door port runs through the NIVO MCP gateway. */
export class EngineDoorBindingService implements OnModuleInit {
    constructor(
        private readonly runner: ModuleJobRunnerService,
        private readonly door: EngineDoorService,
    ) {}

    /** Binds the door to the runner once. */
    onModuleInit(): void {
        this.runner.bindDoor(this.door)
    }
}
