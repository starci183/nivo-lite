import { Module } from "@nestjs/common"
import { RunCommandStep } from "./steps/run-command.step"

@Module({ providers: [RunCommandStep], exports: [RunCommandStep] })
/** The application of the inventory-command job: its step; the queue transport module imports it. */
export class InventoryCommandModule {}
