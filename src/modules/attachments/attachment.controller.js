import attachmentService from './attachment.service.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const attachmentController = {
  upload: asyncHandler(async (req, res) => {
    const attachment = await attachmentService.saveAttachment(
      req.params.taskId,
      req.user.user_id,
      req.file
    );
    return sendCreated(res, 'File uploaded and attached to task successfully', { attachment });
  }),

  list: asyncHandler(async (req, res) => {
    const attachments = await attachmentService.listAttachments(req.params.taskId);
    return sendSuccess(res, 'Task attachments retrieved successfully', { attachments });
  }),

  delete: asyncHandler(async (req, res) => {
    await attachmentService.deleteAttachment(req.params.attachmentId, req.user);
    return sendNoContent(res);
  }),
};

export default attachmentController;
