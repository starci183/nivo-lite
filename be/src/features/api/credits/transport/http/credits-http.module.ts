import { Module } from "@nestjs/common"
import { CreditsApiModule } from "../../credits.module"
import { CreditsController } from "./credits.controller"

@Module({
    imports: [CreditsApiModule],
    controllers: [CreditsController],
})
/** The HTTP transport of the credits feature. */
export class CreditsHttpModule {}
