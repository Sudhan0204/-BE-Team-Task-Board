import labelModel from './label.model.js';
import taskModel from '../tasks/task.model.js';
import { ApiError } from '../../utils/ApiError.js';

export const labelService = {
  /**
   * Create a new label within a project
   */
  async createLabel(projectId, { name, color }) {
    const existing = await labelModel.findByProjectAndName(projectId, name.trim());
    if (existing) {
      throw ApiError.conflict(`A label with name '${name}' already exists in this project.`);
    }

    return labelModel.create({
      project_id: projectId,
      name: name.trim(),
      color: color || '#6366F1',
    });
  },

  /**
   * List all labels for a project
   */
  async listLabels(projectId) {
    return labelModel.listByProject(projectId);
  },

  /**
   * Update label
   */
  async updateLabel(labelId, updates) {
    const label = await labelModel.findById(labelId);
    if (!label) {
      throw ApiError.notFound('Label not found.');
    }

    if (updates.name && updates.name.trim() !== label.name) {
      const existing = await labelModel.findByProjectAndName(label.project_id, updates.name.trim());
      if (existing) {
        throw ApiError.conflict(`A label with name '${updates.name}' already exists in this project.`);
      }
    }

    return labelModel.update(labelId, updates);
  },

  /**
   * Delete label
   */
  async deleteLabel(labelId) {
    const label = await labelModel.findById(labelId);
    if (!label) {
      throw ApiError.notFound('Label not found.');
    }

    await labelModel.delete(labelId);
    return { success: true };
  },

  /**
   * Assign label to task with cross-project validation
   */
  async assignLabelToTask(taskId, labelId) {
    const [task, label] = await Promise.all([
      taskModel.findById(taskId),
      labelModel.findById(labelId),
    ]);

    if (!task) throw ApiError.notFound('Task not found.');
    if (!label) throw ApiError.notFound('Label not found.');

    // CRITICAL: Prevent cross-project label assignment
    if (String(task.project_id) !== String(label.project_id)) {
      throw ApiError.badRequest(
        'Cross-project label assignment is strictly forbidden. The label and task must belong to the exact same project.'
      );
    }

    await labelModel.assignLabel(taskId, labelId);
    return { success: true, task_id: taskId, label_id: labelId };
  },

  /**
   * Remove label from task
   */
  async removeLabelFromTask(taskId, labelId) {
    await labelModel.removeLabelAssignment(taskId, labelId);
    return { success: true };
  },

  /**
   * Get labels for task
   */
  async getTaskLabels(taskId) {
    return labelModel.getLabelsForTask(taskId);
  },
};

export default labelService;
