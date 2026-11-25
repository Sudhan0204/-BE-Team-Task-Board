import db from '../../config/database.js';

export const attachmentModel = {
  async create({ tenant_id, task_id, uploaded_by, file_name, file_url, mime_type, file_size_bytes }) {
    const [attachment] = await db('task_attachments')
      .insert({
        tenant_id,
        task_id,
        uploaded_by,
        file_name,
        file_url,
        mime_type,
        file_size_bytes,
      })
      .returning([
        'attachment_id',
        'tenant_id',
        'task_id',
        'uploaded_by',
        'file_name',
        'file_url',
        'mime_type',
        'file_size_bytes',
        'created_at',
      ]);
    return attachment;
  },

  async findById(attachmentId, tenantId = null) {
    const query = db('task_attachments as a')
      .join('tasks as t', 'a.task_id', 't.task_id')
      .join('users as u', 'a.uploaded_by', 'u.user_id')
      .select([
        'a.attachment_id',
        'a.tenant_id',
        'a.task_id',
        'a.uploaded_by',
        'a.file_name',
        'a.file_url',
        'a.mime_type',
        'a.file_size_bytes',
        'a.created_at',
        't.project_id',
        'u.full_name as uploader_name',
        'u.email as uploader_email',
      ])
      .where('a.attachment_id', attachmentId);

    if (tenantId) query.andWhere('a.tenant_id', tenantId);
    return query.first();
  },

  async listByTask(taskId, tenantId = null) {
    const query = db('task_attachments as a')
      .join('users as u', 'a.uploaded_by', 'u.user_id')
      .select([
        'a.attachment_id',
        'a.tenant_id',
        'a.task_id',
        'a.uploaded_by',
        'a.file_name',
        'a.file_url',
        'a.mime_type',
        'a.file_size_bytes',
        'a.created_at',
        'u.full_name as uploader_name',
      ])
      .where('a.task_id', taskId)
      .orderBy('a.created_at', 'desc');

    if (tenantId) query.andWhere('a.tenant_id', tenantId);
    return query;
  },

  async delete(attachmentId, tenantId = null) {
    const query = db('task_attachments').where('attachment_id', attachmentId);
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.delete();
  },
};

export default attachmentModel;
