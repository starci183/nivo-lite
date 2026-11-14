import { Module } from "@nestjs/common"
import { GetSepayConnectionHandler } from "./application/get-sepay-connection.handler"
import { ListSepayEventsHandler } from "./application/list-sepay-events.handler"
import { RevealSepayKeyHandler } from "./application/reveal-sepay-key.handler"
import { RotateSepayKeyHandler } from "./application/rotate-sepay-key.handler"
import { ConfigurableModuleClass } from "./sepay-connection.module-definition"

@Module({
    providers: [
        GetSepayConnectionHandler,
        ListSepayEventsHandler,
        RevealSepayKeyHandler,
        RotateSepayKeyHandler,
    ],
})
/** The sepay-connection feature: the handlers of the SePay connection page operations. */
export class SepayConnectionApiModule extends ConfigurableModuleClass {}
