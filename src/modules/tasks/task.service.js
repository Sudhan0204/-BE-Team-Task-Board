import taskModel from './task.model.js';
import projectModel from '../projects/project.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPaginationParams } from '../../utils/pagination.js';
import { TASK_STATUSES } from './task.validation.js';
import notificationService from '../notifications/notification.service.js';

const ALLOWED_TASK_SORT_COLUMNS = ['created_at', 'updated_at', 'position', 'due_date', 'priority', 'title'];

export const taskService = {
  /**
   * Create a new task within a project
   */
  async createTask(projectId, userId, data) {
    // Validate assignee if provided
    if (data.assigned_to) {
      const isMember = await projectModel.getMember(projectId, data.assigned_to);
      if (!isMember) {
        throw ApiError.badRequest('Assigned user must be a verified member of this project.');
      }
    }

    const task = await taskModel.create({
      project_id: projectId,
      title: data.title.trim(),
      description: data.description,
      status: data.status || 'backlog',
      priority: data.priority || 'medium',
      created_by: userId,
      assigned_to: data.assigned_to || null,
      due_date: data.due_date || null,
      position: data.position ?? 1000,
    });

    if (task.assigned_to && String(task.assigned_to) !== String(userId)) {
      notificationService.notifyUser({
        userId: task.assigned_to,
        taskId: task.task_id,
        title: 'Task Assigned',
        message: `You were assigned to task: "${task.title}"`,
      });
    }

    return task;
  },

  /**
   * Get task by ID
   */
  async getTaskById(taskId) {
    const task = await taskModel.findById(taskId);
    if (!task) {
      throw ApiError.notFound('Task not found.');
    }
    return task;
  },

  /**
   * List tasks for a project with filtering, search, and pagination
   */
  async listTasks(projectId, query) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 20,
      maxLimit: 100,
      allowedSortColumns: ALLOWED_TASK_SORT_COLUMNS,
      defaultSort: 'position',
      defaultOrder: 'asc',
    });

    const filters = {
      status: query.status,
      priority: query.priority,
      assigned_to: query.assigned_to,
      due_date: query.due_date,
      search: query.search,
    };

    const { tasks, total } = await taskModel.list({
      projectId,
      filters,
      pagination,
    });

    return {
      tasks,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  },

  /**
   * Retrieves tasks structured for the Kanban board view, grouped by status column
   */
  async getKanbanBoard(projectId) {
    const allTasks = await taskModel.getBoardTasks(projectId);

    // Group tasks by status columns
    const columns = {};
    for (const status of TASK_STATUSES) {
      columns[status] = [];
    }

    for (const task of allTasks) {
      if (columns[task.status]) {
        columns[task.status].push(task);
      } else {
        // Fallback for custom or unmapped status
        columns[task.status] = [task];
      }
    }

    return {
      columns,
      totalTasks: allTasks.length,
    };
  },

  /**
   * Update task general fields
   */
  async updateTask(taskId, currentTask, userId, updates) {
    // 1. Verify assignee eligibility if updating assigned_to
    if (updates.assigned_to !== undefined && updates.assigned_to !== null) {
      const isMember = await projectModel.getMember(currentTask.project_id, updates.assigned_to);
      if (!isMember) {
        throw ApiError.badRequest('Assigned user must be a member of this project.');
      }
    }

    // 2. Adjust completed_at when status changes
    const finalUpdates = { ...updates };
    if (updates.status) {
      if (updates.status === 'done' && currentTask.status !== 'done') {
        finalUpdates.completed_at = new Date();
      } else if (updates.status !== 'done' && currentTask.status === 'done') {
        finalUpdates.completed_at = null;
      }
    }

    // Capture diff for activity log
    const oldValue = {};
    const newValue = {};
    for (const key of Object.keys(updates)) {
      if (currentTask[key] !== updates[key]) {
        oldValue[key] = currentTask[key];
        newValue[key] = updates[key];
      }
    }

    return taskModel.updateWithActivity(
      taskId,
      finalUpdates,
      userId,
      'updated',
      Object.keys(oldValue).length > 0 ? oldValue : null,
      Object.keys(newValue).length > 0 ? newValue : null
    );
  },

  /**
   * Specialized status update endpoint
   */
  async updateStatus(taskId, currentTask, userId, newStatus) {
    if (currentTask.status === newStatus) {
      return currentTask;
    }

    const updates = { status: newStatus };
    if (newStatus === 'done') {
      updates.completed_at = new Date();
    } else if (currentTask.status === 'done') {
      updates.completed_at = null;
    }

    return taskModel.updateWithActivity(
      taskId,
      updates,
      userId,
      'status_changed',
      { status: currentTask.status },
      { status: newStatus }
    );
  },

  /**
   * Specialized assignee update endpoint
   */
  async updateAssignee(taskId, currentTask, userId, newAssigneeId) {
    if (newAssigneeId !== null) {
      const isMember = await projectModel.getMember(currentTask.project_id, newAssigneeId);
      if (!isMember) {
        throw ApiError.badRequest('Assigned user must be a member of this project.');
      }
    }

    const updated = await taskModel.updateWithActivity(
      taskId,
      { assigned_to: newAssigneeId },
      userId,
      newAssigneeId ? 'assigned' : 'unassigned',
      { assigned_to: currentTask.assigned_to },
      { assigned_to: newAssigneeId }
    );

    if (newAssigneeId && String(newAssigneeId) !== String(userId)) {
      notificationService.notifyUser({
        userId: newAssigneeId,
        taskId,
        title: 'Task Assigned',
        message: `You were assigned to task: "${currentTask.title}"`,
      });
    }

    return updated;
  },

  /**
   * Specialized position reordering endpoint (Kanban drag-and-drop)
   */
  async updatePosition(taskId, currentTask, userId, newPosition, newStatus) {
    const updates = { position: newPosition };
    const oldValue = { position: currentTask.position };
    const newValue = { position: newPosition };

    if (newStatus && newStatus !== currentTask.status) {
      updates.status = newStatus;
      oldValue.status = currentTask.status;
      newValue.status = newStatus;

      if (newStatus === 'done') {
        updates.completed_at = new Date();
      } else if (currentTask.status === 'done') {
        updates.completed_at = null;
      }
    }

    return taskModel.updateWithActivity(
      taskId,
      updates,
      userId,
      'position_changed',
      oldValue,
      newValue
    );
  },

  /**
   * Delete task
   */
  async deleteTask(taskId) {
    await taskModel.delete(taskId);
    return { success: true };
  },

  /**
   * Retrieve activity audit logs for a project
   */
  async getProjectActivity(projectId) {
    return taskModel.getActivityLogs(projectId);
  },
};

export default taskService;
