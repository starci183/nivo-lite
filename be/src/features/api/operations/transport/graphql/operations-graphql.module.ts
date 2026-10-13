import { Module } from "@nestjs/common"
import { HiringGraphqlModule } from "@features/api/hiring"
import { InventoryGraphqlModule } from "@features/api/inventory"
import { ShiftsGraphqlModule } from "@features/api/shifts"

@Module({ imports: [InventoryGraphqlModule, ShiftsGraphqlModule, HiringGraphqlModule] })
/** The GraphQL transports of the three operations capabilities, grouped so the app module stays inside its size budget. */
export class OperationsGraphqlModule {}
