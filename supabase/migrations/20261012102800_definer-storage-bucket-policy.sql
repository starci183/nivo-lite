-- knowledge-uploads declared a size limit but no allowed_mime_types; pin the types the knowledge drawer accepts
-- (txt, md, csv, pdf, docx, xlsx, pptx, zip). The bucket stays private and its storage.objects policies are unchanged.
update storage.buckets
set allowed_mime_types = array[
  'text/plain', 'text/markdown', 'text/x-markdown', 'text/csv', 'application/csv', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-zip-compressed', 'application/octet-stream'
]
where id = 'knowledge-uploads';
