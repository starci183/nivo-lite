/** Log events of the website intake: ids and codes only, never what a visitor wrote. */
export enum WebsiteIntakeLogEvent {
    /** A website submission woke its owning agent. */
    SubmissionWoke = "website_intake.submission.woke",
    /** The wake of a website submission was not written (a repeat, or a refused tag); the contact and the input are stored. */
    SubmissionNotWoken = "website_intake.submission.not_woken",
}
