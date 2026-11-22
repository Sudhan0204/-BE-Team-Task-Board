import fs from 'fs';
import path from 'path';
import attachmentModel from './attachment.model.js';
import projectModel from '../projects/project.model.js';
import { ApiError } from '../../utils/ApiError.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';

export const attachmentService = {
  /**
   * Process uploaded file and persist metadata record in task_attachments
   */
  async saveAttachment(taskId, userId, file) {
    if (!file) {
      throw ApiError.badRequest('No file was uploaded.');
    }

    const fileUrl = `${env.APP_URL}/uploads/${file.filename}`;

    const attachment = await attachmentModel.create({
      task_id: taskId,
      uploaded_by: userId,
      file_name: file.originalname,
      file_url: fileUrl,
      mime_type: file.mimetype,
      file_size_bytes: file.size,
    });

    return attachment;
  },

  /**
   * List attachments for task
   */
  async listAttachments(taskId) {
    return attachmentModel.listByTask(taskId);
  },

  /**
   * Delete attachment record and underlying physical file
   */
  async deleteAttachment(attachmentId, actorUser) {
    const attachment = await attachmentModel.findById(attachmentId);
    if (!attachment) {
      throw ApiError.notFound('Attachment not found.');
    }

    // Permission check: uploader or project lead/admin
    const isUploader = String(attachment.uploaded_by) === String(actorUser.user_id);
    if (!isUploader) {
      const projectMember = await projectModel.getMember(attachment.project_id, actorUser.user_id);
      const isLead = projectMember?.role === 'lead';
      if (!isLead) {
        throw ApiError.forbidden('You do not have permission to delete this attachment.');
      }
    }

    // 1. Delete database record
    await attachmentModel.delete(attachmentId);

    // 2. Remove physical file safely
    try {
      const filename = path.basename(attachment.file_url);
      const filePath = path.resolve(process.cwd(), 'uploads', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      logger.warn('Failed to delete physical attachment file from disk', { error: err.message });
    }

    return { success: true };
  },
};

export default attachmentService;
