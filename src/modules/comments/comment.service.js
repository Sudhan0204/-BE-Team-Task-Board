import commentModel from './comment.model.js';
import projectModel from '../projects/project.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPaginationParams } from '../../utils/pagination.js';

export const commentService = {
  async createComment(taskId, userId, { comment_text }, tenantId = null) {
    return commentModel.create({
      tenant_id: tenantId,
      task_id: taskId,
      user_id: userId,
      comment_text: comment_text.trim(),
    });
  },

  async listComments(taskId, query, tenantId = null) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 30,
      maxLimit: 100,
    });

    const { comments, total } = await commentModel.listByTask(taskId, pagination, tenantId);

    return {
      comments,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  },

  async updateComment(commentId, actorUser, { comment_text }, tenantId = null, canModerate = false) {
    const comment = await commentModel.findById(commentId, tenantId);
    if (!comment) {
      throw ApiError.notFound('Comment not found.');
    }

    const isAuthor = String(comment.user_id) === String(actorUser.user_id);
    if (!isAuthor && !canModerate) {
      const projectMember = await projectModel.getMember(comment.project_id, actorUser.user_id, tenantId);
      const isLead = projectMember?.role === 'lead' || projectMember?.role === 'project_manager';
      if (!isLead) {
        throw ApiError.forbidden('You can only edit your own comments.');
      }
    }

    return commentModel.update(commentId, comment_text.trim(), tenantId);
  },

  async deleteComment(commentId, actorUser, tenantId = null, canModerate = false) {
    const comment = await commentModel.findById(commentId, tenantId);
    if (!comment) {
      throw ApiError.notFound('Comment not found.');
    }

    const isAuthor = String(comment.user_id) === String(actorUser.user_id);
    if (!isAuthor && !canModerate) {
      const projectMember = await projectModel.getMember(comment.project_id, actorUser.user_id, tenantId);
      const isLead = projectMember?.role === 'lead' || projectMember?.role === 'project_manager';
      if (!isLead) {
        throw ApiError.forbidden('You do not have permission to delete this comment.');
      }
    }

    await commentModel.delete(commentId, tenantId);
    return { success: true };
  },
};

export default commentService;
