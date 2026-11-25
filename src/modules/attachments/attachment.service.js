import fs from 'fs';
import path from 'path';
import attachmentModel from './attachment.model.js';
import projectModel from '../projects/project.model.js';
import { ApiError } from '../../utils/ApiError.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';

export const attachmentService = {
  async saveAttachment(taskId, userId, file, tenantId = null) {
    if (!file) {
      throw ApiError.badRequest('No file was uploaded.');
    }

    const fileUrl = `${env.APP_URL}/uploads/${file.filename}`;

    return attachmentModel.create({
      tenant_id: tenantId,
      task_id: taskId,
      uploaded_by: userId,
      file_name: file.originalname,
      file_url: fileUrl,
      mime_type: file.mimetype,
      file_size_bytes: file.size,
    });
  },

  async listAttachments(taskId, tenantId = null) {
    return attachmentModel.listByTask(taskId, tenantId);
  },

  async deleteAttachment(attachmentId, actorUser, tenantId = null, canModerate = false) {
    const attachment = await attachmentModel.findById(attachmentId, tenantId);
    if (!attachment) {
      throw ApiError.notFound('Attachment not found.');
    }

    const isUploader = String(attachment.uploaded_by) === String(actorUser.user_id);
    if (!isUploader && !canModerate) {
      const projectMember = await projectModel.getMember(
        attachment.project_id,
        actorUser.user_id,
        tenantId
      );
      const isLead = projectMember?.role === 'lead' || projectMember?.role === 'project_manager';
      if (!isLead) {
        throw ApiError.forbidden('You do not have permission to delete this attachment.');
      }
    }

    await attachmentModel.delete(attachmentId, tenantId);

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
