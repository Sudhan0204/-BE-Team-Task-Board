import commentModel from './comment.model.js';
import projectModel from '../projects/project.model.js';
import organizationModel from '../organizations/organization.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPaginationParams } from '../../utils/pagination.js';

export const commentService = {
  /**
   * Add a comment to a task
   */
  async createComment(taskId, userId, { comment_text }) {
    return commentModel.create({
      task_id: taskId,
      user_id: userId,
      comment_text: comment_text.trim(),
    });
  },

  /**
   * List comments on a task with pagination
   */
  async listComments(taskId, query) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 30,
      maxLimit: 100,
    });

    const { comments, total } = await commentModel.listByTask(taskId, pagination);

    return {
      comments,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  },

  /**
   * Update comment text (Author or Admin only)
   */
  async updateComment(commentId, actorUser, { comment_text }) {
    const comment = await commentModel.findById(commentId);
    if (!comment) {
      throw ApiError.notFound('Comment not found.');
    }

    const isAuthor = String(comment.user_id) === String(actorUser.user_id);
    if (!isAuthor) {
      // Check if actor is project lead or org admin/owner
      const projectMember = await projectModel.getMember(comment.project_id, actorUser.user_id);
      const isLead = projectMember?.role === 'lead';
      if (!isLead) {
        throw ApiError.forbidden('You can only edit your own comments.');
      }
    }

    return commentModel.update(commentId, comment_text.trim());
  },

  /**
   * Delete comment (Author or Admin only)
   */
  async deleteComment(commentId, actorUser) {
    const comment = await commentModel.findById(commentId);
    if (!comment) {
      throw ApiError.notFound('Comment not found.');
    }

    const isAuthor = String(comment.user_id) === String(actorUser.user_id);
    if (!isAuthor) {
      const projectMember = await projectModel.getMember(comment.project_id, actorUser.user_id);
      const isLead = projectMember?.role === 'lead';
      if (!isLead) {
        throw ApiError.forbidden('You do not have permission to delete this comment.');
      }
    }

    await commentModel.delete(commentId);
    return { success: true };
  },
};

export default commentService;
