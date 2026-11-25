import attachmentService from './attachment.service.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const attachmentController = {
  upload: asyncHandler(async (req, res) => {
    const attachment = await attachmentService.saveAttachment(
      req.params.taskId,
      req.user.user_id,
      req.file,
      req.tenantId
    );
    return sendCreated(res, 'File uploaded and attached to task successfully', { attachment });
  }),

  list: asyncHandler(async (req, res) => {
    const attachments = await attachmentService.listAttachments(req.params.taskId, req.tenantId);
    return sendSuccess(res, 'Task attachments retrieved successfully', { attachments });
  }),

  delete: asyncHandler(async (req, res) => {
    const canModerate = req.isCompanyAdmin || req.permissionSet?.has('tasks.delete');
    await attachmentService.deleteAttachment(
      req.params.attachmentId,
      req.user,
      req.tenantId,
      canModerate
    );
    return sendNoContent(res);
  }),
};

export default attachmentController;
