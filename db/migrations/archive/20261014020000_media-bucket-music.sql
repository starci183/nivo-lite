-- The shared music beds of the video render live in the private media bucket under music/<track>.mp3 (uploaded by `cli seed-media upload`,
-- read by the be with the service role). The bucket only admitted images and video; add the audio type. No policy changes: the member
-- policies key on a workspace uuid folder, so a music/ object is invisible to every member and reachable only through the service role.
update storage.buckets
set allowed_mime_types = array(select distinct unnest(allowed_mime_types || array['audio/mpeg']))
where id = 'media';
