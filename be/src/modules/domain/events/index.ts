// Read services lead the barrel: other capabilities import this barrel while it loads (import cycles), they must already be defined.
export { EventsActivityReadService } from "./events-activity-read.service"
export { EventsModule } from "./events.module"
export { EventsService } from "./events.service"
export { EventsReadService } from "./events-read.service"
export type { EventRecordRow } from "./events.contracts"
export { eventsEntities } from "./persistence/entities"
