import { Module } from "@nestjs/common"
import { CreateContentItemHandler } from "./application/create-content-item.handler"
import { SaveContentItemHandler } from "./application/save-content-item.handler"
import { MoveContentItemHandler } from "./application/move-content-item.handler"
import { TransitionContentItemHandler } from "./application/transition-content-item.handler"
import { GetContentActorHandler } from "./application/content-actor.handler"
import { GetContentFiguresHandler } from "./application/content-figures.handler"
import { GetContentWorkbenchHandler } from "./application/content-workbench.handler"
import { ListContentItemsHandler } from "./application/content-items.handler"
import { GetContentItemHandler } from "./application/content-item.handler"
import { ConfigurableModuleClass } from "./content.module-definition"

@Module({
    providers: [
        CreateContentItemHandler,
        SaveContentItemHandler,
        MoveContentItemHandler,
        TransitionContentItemHandler,
        GetContentActorHandler,
        GetContentFiguresHandler,
        GetContentWorkbenchHandler,
        ListContentItemsHandler,
        GetContentItemHandler,
    ],
})
/** Content application handlers. */
export class ContentApiModule extends ConfigurableModuleClass {}
