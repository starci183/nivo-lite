import type { AutomationPipelinesService } from "@modules/domain/automation-pipelines"

/** The template of the shift reminder automation. */
export const REMINDER_TEMPLATE = "shifts_shift_reminder"
/** The template of the monthly hours close automation. */
export const MONTH_CLOSE_TEMPLATE = "shifts_month_close"
/** The most workspaces one tick reads. */
export const PIPELINES_MAX = 2000

/** Whether the shift reminders of one workspace are on. */
export const isReminderOn = async (pipelines: AutomationPipelinesService, workspaceId: string): Promise<boolean> =>
    (await pipelines.findPipeline(workspaceId, REMINDER_TEMPLATE))?.enabled === true
