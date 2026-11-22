import commentService from './comment.service.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const commentController = {
  create: asyncHandler(async (req, res) => {
    const comment = await commentService.createComment(
      req.params.taskId,
      req.user.user_id,
      req.body
    );
    return sendCreated(res, 'Comment posted successfully', { comment });
  }),

  list: asyncHandler(async (req, res) => {
    const { comments, pagination } = await commentService.listComments(
      req.params.taskId,
      req.query
    );
    return sendPaginated(res, comments, pagination, 'Comments retrieved successfully');
  }),

  update: asyncHandler(async (req, res) => {
    const comment = await commentService.updateComment(
      req.params.commentId,
      req.user,
      req.body
    );
    return sendSuccess(res, 'Comment updated successfully', { comment });
  }),

  delete: asyncHandler(async (req, res) => {
    await commentService.deleteComment(req.params.commentId, req.user);
    return sendNoContent(res);
  }),
};

export default commentController;
