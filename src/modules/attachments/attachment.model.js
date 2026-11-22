import db from '../../config/database.js';

export const attachmentModel = {
  /**
   * Insert attachment metadata record into task_attachments
   */
  async create({ task_id, uploaded_by, file_name, file_url, mime_type, file_size_bytes }) {
    const [attachment] = await db('task_attachments')
      .insert({
        task_id,
        uploaded_by,
        file_name,
        file_url,
        mime_type,
        file_size_bytes,
      })
      .returning([
        'attachment_id',
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

  /**
   * Retrieve attachment by ID with task and project info
   */
  async findById(attachmentId) {
    return db('task_attachments as a')
      .join('tasks as t', 'a.task_id', 't.task_id')
      .join('users as u', 'a.uploaded_by', 'u.user_id')
      .select([
        'a.attachment_id',
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
      .where('a.attachment_id', attachmentId)
      .first();
  },

  /**
   * List all attachments for a specific task
   */
  async listByTask(taskId) {
    return db('task_attachments as a')
      .join('users as u', 'a.uploaded_by', 'u.user_id')
      .select([
        'a.attachment_id',
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
  },

  /**
   * Delete attachment record
   */
  async delete(attachmentId) {
    return db('task_attachments')
      .where('attachment_id', attachmentId)
      .delete();
  },
};

export default attachmentModel;
