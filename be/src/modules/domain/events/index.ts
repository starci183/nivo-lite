// Read services lead the barrel: other capabilities import this barrel while it loads (import cycles), they must already be defined.
export { EventsModule } from "./events.module"
export { EventsService } from "./events.service"
export { EventsReadService } from "./events-read.service"
export { eventsEntities } from "./persistence/entities"
export type { EventEntry } from "./events.contracts"
