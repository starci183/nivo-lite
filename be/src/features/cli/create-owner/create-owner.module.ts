import { Module } from "@nestjs/common"
import { CreateOwnerCli } from "./create-owner.cli"
import { ConfigurableModuleClass } from "./create-owner.module-definition"
import { RunCreateOwnerCli } from "./subs/run.cli"

@Module({ providers: [CreateOwnerCli, RunCreateOwnerCli] })
/** The create-owner group: the command and its one sub-command over the owner bootstrap. */
export class CreateOwnerModule extends ConfigurableModuleClass {}
