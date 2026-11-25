import labelModel from './label.model.js';
import taskModel from '../tasks/task.model.js';
import { ApiError } from '../../utils/ApiError.js';

export const labelService = {
  async createLabel(projectId, { name, color }, tenantId = null) {
    const existing = await labelModel.findByProjectAndName(projectId, name.trim(), tenantId);
    if (existing) {
      throw ApiError.conflict(`A label with name '${name}' already exists in this project.`);
    }

    return labelModel.create({
      tenant_id: tenantId,
      project_id: projectId,
      name: name.trim(),
      color: color || '#6366F1',
    });
  },

  async listLabels(projectId, tenantId = null) {
    return labelModel.listByProject(projectId, tenantId);
  },

  async updateLabel(labelId, updates, tenantId = null) {
    const label = await labelModel.findById(labelId, tenantId);
    if (!label) {
      throw ApiError.notFound('Label not found.');
    }

    if (updates.name && updates.name.trim() !== label.name) {
      const existing = await labelModel.findByProjectAndName(
        label.project_id,
        updates.name.trim(),
        tenantId
      );
      if (existing) {
        throw ApiError.conflict(`A label with name '${updates.name}' already exists in this project.`);
      }
    }

    return labelModel.update(labelId, updates, tenantId);
  },

  async deleteLabel(labelId, tenantId = null) {
    const label = await labelModel.findById(labelId, tenantId);
    if (!label) {
      throw ApiError.notFound('Label not found.');
    }

    await labelModel.delete(labelId, tenantId);
    return { success: true };
  },

  async assignLabelToTask(taskId, labelId, tenantId = null) {
    const [task, label] = await Promise.all([
      taskModel.findById(taskId, tenantId),
      labelModel.findById(labelId, tenantId),
    ]);

    if (!task) throw ApiError.notFound('Task not found.');
    if (!label) throw ApiError.notFound('Label not found.');

    if (String(task.project_id) !== String(label.project_id)) {
      throw ApiError.badRequest(
        'Cross-project label assignment is strictly forbidden. The label and task must belong to the exact same project.'
      );
    }

    await labelModel.assignLabel(taskId, labelId);
    return { success: true, task_id: taskId, label_id: labelId };
  },

  async removeLabelFromTask(taskId, labelId) {
    await labelModel.removeLabelAssignment(taskId, labelId);
    return { success: true };
  },

  async getTaskLabels(taskId, tenantId = null) {
    return labelModel.getLabelsForTask(taskId, tenantId);
  },
};

export default labelService;
