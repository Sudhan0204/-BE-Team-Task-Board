import taskModel from './task.model.js';
import projectModel from '../projects/project.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPaginationParams } from '../../utils/pagination.js';
import { TASK_STATUSES } from './task.validation.js';
import notificationService from '../notifications/notification.service.js';

const ALLOWED_TASK_SORT_COLUMNS = ['created_at', 'updated_at', 'position', 'due_date', 'priority', 'title'];

export const taskService = {
  /**
   * Create a new tenant-scoped task within a project
   */
  async createTask(projectId, userId, data, tenantId = null) {
    if (data.assigned_to) {
      const isMember = await projectModel.getMember(projectId, data.assigned_to, tenantId);
      if (!isMember) {
        throw ApiError.badRequest('Assigned user must be a verified member of this project.');
      }
    }

    const task = await taskModel.create({
      tenant_id: tenantId,
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
        tenantId: tenantId || task.tenant_id,
        userId: task.assigned_to,
        taskId: task.task_id,
        title: 'Task Assigned',
        message: `You were assigned to task: "${task.title}"`,
      });
    }

    return task;
  },

  async listTenantTasks(tenantId, userId, canViewAll, query) {
    const pagination = getPaginationParams(query, {
      defaultLimit: 50,
      maxLimit: 100,
      allowedSortColumns: ALLOWED_TASK_SORT_COLUMNS,
      defaultSort: 'created_at',
      defaultOrder: 'desc',
    });

    const { tasks, total } = await taskModel.listByTenant(tenantId, userId, {
      canViewAll,
      filters: {
        project_id: query.project_id,
        status: query.status,
        priority: query.priority,
        assigned_to: query.assigned_to,
        search: query.search,
      },
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

  async getTaskById(taskId, tenantId = null) {
    const task = await taskModel.findById(taskId, tenantId);
    if (!task) {
      throw ApiError.notFound('Task not found.');
    }
    return task;
  },

  async listTasks(projectId, query, tenantId = null) {
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
      tenantId,
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

  async getKanbanBoard(projectId, tenantId = null) {
    const allTasks = await taskModel.getBoardTasks(projectId, tenantId);

    const columns = {};
    for (const status of TASK_STATUSES) {
      columns[status] = [];
    }

    for (const task of allTasks) {
      if (columns[task.status]) {
        columns[task.status].push(task);
      } else {
        columns[task.status] = [task];
      }
    }

    return {
      columns,
      totalTasks: allTasks.length,
    };
  },

  async updateTask(taskId, currentTask, userId, updates, tenantId = null) {
    if (updates.assigned_to !== undefined && updates.assigned_to !== null) {
      const isMember = await projectModel.getMember(
        currentTask.project_id,
        updates.assigned_to,
        tenantId
      );
      if (!isMember) {
        throw ApiError.badRequest('Assigned user must be a member of this project.');
      }
    }

    const finalUpdates = { ...updates };
    if (updates.status) {
      if (updates.status === 'done' && currentTask.status !== 'done') {
        finalUpdates.completed_at = new Date();
      } else if (updates.status !== 'done' && currentTask.status === 'done') {
        finalUpdates.completed_at = null;
      }
    }

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
      Object.keys(newValue).length > 0 ? newValue : null,
      tenantId
    );
  },

  async updateStatus(taskId, currentTask, userId, newStatus, tenantId = null) {
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
      { status: newStatus },
      tenantId
    );
  },

  async updateAssignee(taskId, currentTask, userId, newAssigneeId, tenantId = null) {
    if (newAssigneeId !== null) {
      const isMember = await projectModel.getMember(
        currentTask.project_id,
        newAssigneeId,
        tenantId
      );
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
      { assigned_to: newAssigneeId },
      tenantId
    );

    if (newAssigneeId && String(newAssigneeId) !== String(userId)) {
      notificationService.notifyUser({
        tenantId: tenantId || currentTask.tenant_id,
        userId: newAssigneeId,
        taskId,
        title: 'Task Assigned',
        message: `You were assigned to task: "${currentTask.title}"`,
      });
    }

    return updated;
  },

  async updatePosition(taskId, currentTask, userId, newPosition, newStatus, tenantId = null) {
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
      newValue,
      tenantId
    );
  },

  async deleteTask(taskId, tenantId = null) {
    await taskModel.delete(taskId, tenantId);
    return { success: true };
  },

  async getProjectActivity(projectId, tenantId = null) {
    return taskModel.getActivityLogs(projectId, null, tenantId);
  },
};

export default taskService;
