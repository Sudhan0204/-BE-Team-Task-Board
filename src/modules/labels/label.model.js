import db from '../../config/database.js';

export const labelModel = {
  /**
   * Create a new label in a project
   */
  async create({ project_id, name, color }) {
    const [label] = await db('task_labels')
      .insert({
        project_id,
        name,
        color: color || '#6366F1',
      })
      .returning(['label_id', 'project_id', 'name', 'color', 'created_at']);
    return label;
  },

  /**
   * Find label by project and name
   */
  async findByProjectAndName(projectId, name) {
    return db('task_labels')
      .where({
        project_id: projectId,
        name,
      })
      .first();
  },

  /**
   * List all labels for a project
   */
  async listByProject(projectId) {
    return db('task_labels')
      .where('project_id', projectId)
      .orderBy('name', 'asc');
  },

  /**
   * Find label by ID
   */
  async findById(labelId) {
    return db('task_labels')
      .where('label_id', labelId)
      .first();
  },

  /**
   * Update label details
   */
  async update(labelId, updates) {
    const [updated] = await db('task_labels')
      .where('label_id', labelId)
      .update(updates)
      .returning(['label_id', 'project_id', 'name', 'color', 'created_at']);
    return updated;
  },

  /**
   * Delete label and any assignments
   */
  async delete(labelId) {
    return db.transaction(async (trx) => {
      await trx('task_label_assignments').where('label_id', labelId).delete();
      return trx('task_labels').where('label_id', labelId).delete();
    });
  },

  /**
   * Assign label to task
   */
  async assignLabel(taskId, labelId) {
    await db('task_label_assignments')
      .insert({
        task_id: taskId,
        label_id: labelId,
      })
      .onConflict(['task_id', 'label_id'])
      .ignore();
    return { success: true };
  },

  /**
   * Remove label assignment from task
   */
  async removeLabelAssignment(taskId, labelId) {
    return db('task_label_assignments')
      .where({
        task_id: taskId,
        label_id: labelId,
      })
      .delete();
  },

  /**
   * Get all labels assigned to a specific task
   */
  async getLabelsForTask(taskId) {
    return db('task_labels as l')
      .join('task_label_assignments as a', 'l.label_id', 'a.label_id')
      .select(['l.label_id', 'l.project_id', 'l.name', 'l.color', 'l.created_at'])
      .where('a.task_id', taskId);
  },
};

export default labelModel;
