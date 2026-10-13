import { Command } from "@nestjs/cqrs"
import type { MineResult } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MineLessonsRequest } from "./mine-lessons.contracts"

/** Asks to study the corrections of one agent and propose lessons. */
export class MineLessonsCommand extends Command<MineResult> {
    constructor(readonly params: ExecuteParams<MineLessonsRequest>) {
        super()
    }
}
