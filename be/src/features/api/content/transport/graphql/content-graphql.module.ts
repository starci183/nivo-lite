import { Module } from "@nestjs/common"
import { ContentApiModule } from "../../content.module"
import { CreateContentItemResolver } from "./create-content-item.resolver"
import { SaveContentItemResolver } from "./save-content-item.resolver"
import { MoveContentItemResolver } from "./move-content-item.resolver"
import { TransitionContentItemResolver } from "./transition-content-item.resolver"
import { GetContentActorResolver } from "./content-actor.resolver"
import { GetContentFiguresResolver } from "./content-figures.resolver"
import { GetContentWorkbenchResolver } from "./content-workbench.resolver"
import { ListContentItemsResolver } from "./content-items.resolver"
import { GetContentItemResolver } from "./content-item.resolver"

@Module({
    imports: [ContentApiModule],
    providers: [
        CreateContentItemResolver,
        SaveContentItemResolver,
        MoveContentItemResolver,
        TransitionContentItemResolver,
        GetContentActorResolver,
        GetContentFiguresResolver,
        GetContentWorkbenchResolver,
        ListContentItemsResolver,
        GetContentItemResolver,
    ],
})
/** Content GraphQL operations. */
export class ContentGraphqlModule {}
