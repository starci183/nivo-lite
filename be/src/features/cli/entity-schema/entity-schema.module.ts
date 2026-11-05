import { Module } from "@nestjs/common"
import { EntitySchemaCli } from "./entity-schema.cli"
import { ConfigurableModuleClass } from "./entity-schema.module-definition"
import { CheckCli } from "./subs/check.cli"
import { PlanCli } from "./subs/plan.cli"

@Module({ providers: [EntitySchemaCli, PlanCli, CheckCli] })
/** The entities group: its command and sub-commands; the entity planner they delegate to is composed beside it. */
export class EntitySchemaModule extends ConfigurableModuleClass {}
