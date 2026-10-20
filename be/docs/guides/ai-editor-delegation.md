# AI Editor: delegated video renders (HAKUEN demo, N19/N20)

AI Editor is the `video` module's agent (catalog name "AI Editor"). Another agent hands it a script with the
command-bus command `video.render_script`; the full caller contract is in `be/src/modules/domain/video/editor-delegation.policy.ts`
(fields) and the shared contract `contracts/editor-delegation.md` of the demo plan.

Flow: `render_script` work item (gate `auto`) -> `EditorDelegationPerformerService` creates the `video_projects` row and a
`video_delegations` row and queues the real render (`VideoService.requestDelegatedRender`, brand kit + brand frame) ->
render-video job -> `EditorDeliveryService.settle` opens the `publish_video` work item (dedupe
`publish_video:<project>:<render>`), posts the `video_ready` card whose ref/buttons decide it, then a one-line approval ask -> the existing approval performer approves the project.

## DEMO-NOTES (AI Editor)

Real: the render (ffmpeg, VTT captions, TTS when configured, captions-only with `TTS_PROVIDER=none`), the brand kit and
the brand frame, the delegation record, the approval work item and its decision path.

Shortcuts of this build:
- Hub cards: until the Hub card writer (`OfficeCardsService`, branch demo/hub) is merged, `EditorRoomService` posts each card
  as its one-line preview through `OfficeLinesService` (dept `video`) and the full v1 card JSON is kept in
  `video_delegations.card`. Swap `EditorRoomService.post` to `OfficeCardsService.post` with `room: "marketing"` after the merge.
- The card's links are 3-day signed URLs taken when the card is posted; an older card needs the workbench to re-sign.
- The brand frame is always on for delegated renders and off for workbench renders (no brand-kit toggle yet).
- `video_delegations.status` stops at `ready`/`failed`; approval is read from `video_projects.status`.
- No render-progress card yet (the prototype's progress state): the room shows the command mirror line and the card when done.
- Publishing the approved video to the target channels stays with AI Marketing's publishing path.
- Layer 3 (editing style learned from approvals) is not wired; the card's `data.sources` names the layers used (layer 2:
  the workspace brand kit and the delegated script).

## Reuse

Extended: `video` (performer, delivery, brand frame in the render plan, `VideoService.requestDelegatedRender`), `video-projects`
(`createDelegated`), `video-brand-kits` (read unchanged through the render spec), `decisions` (command bus `render_script`
accept, `video_project` subject type, the existing `publish_video` approval performer), `messages` (`OfficeLinesService`).
New only where nothing existed: the `video_delegations` table and its owner capability `video-delegations` (no existing
record of agent-to-agent delegations; the table-owner rule requires a capability named for the table).
