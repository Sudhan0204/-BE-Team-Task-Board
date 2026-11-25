import commentService from './comment.service.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const commentController = {
  create: asyncHandler(async (req, res) => {
    const comment = await commentService.createComment(
      req.params.taskId,
      req.user.user_id,
      req.body,
      req.tenantId
    );
    return sendCreated(res, 'Comment posted successfully', { comment });
  }),

  list: asyncHandler(async (req, res) => {
    const { comments, pagination } = await commentService.listComments(
      req.params.taskId,
      req.query,
      req.tenantId
    );
    return sendPaginated(res, comments, pagination, 'Comments retrieved successfully');
  }),

  update: asyncHandler(async (req, res) => {
    const canModerate = req.isCompanyAdmin || req.permissionSet?.has('comments.update');
    const comment = await commentService.updateComment(
      req.params.commentId,
      req.user,
      req.body,
      req.tenantId,
      canModerate
    );
    return sendSuccess(res, 'Comment updated successfully', { comment });
  }),

  delete: asyncHandler(async (req, res) => {
    const canModerate = req.isCompanyAdmin || req.permissionSet?.has('comments.delete');
    await commentService.deleteComment(
      req.params.commentId,
      req.user,
      req.tenantId,
      canModerate
    );
    return sendNoContent(res);
  }),
};

export default commentController;
