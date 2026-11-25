import db from '../../config/database.js';

export const labelModel = {
  async create({ tenant_id, project_id, name, color }) {
    const [label] = await db('task_labels')
      .insert({
        tenant_id,
        project_id,
        name,
        color: color || '#6366F1',
      })
      .returning(['label_id', 'tenant_id', 'project_id', 'name', 'color', 'created_at']);
    return label;
  },

  async findByProjectAndName(projectId, name, tenantId = null) {
    const query = db('task_labels').where({
      project_id: projectId,
      name,
    });
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.first();
  },

  async listByProject(projectId, tenantId = null) {
    const query = db('task_labels')
      .where('project_id', projectId)
      .orderBy('name', 'asc');
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query;
  },

  async findById(labelId, tenantId = null) {
    const query = db('task_labels').where('label_id', labelId);
    if (tenantId) query.andWhere('tenant_id', tenantId);
    return query.first();
  },

  async update(labelId, updates, tenantId = null) {
    const query = db('task_labels').where('label_id', labelId);
    if (tenantId) query.andWhere('tenant_id', tenantId);

    const [updated] = await query
      .update(updates)
      .returning(['label_id', 'tenant_id', 'project_id', 'name', 'color', 'created_at']);
    return updated;
  },

  async delete(labelId, tenantId = null) {
    return db.transaction(async (trx) => {
      await trx('task_label_assignments').where('label_id', labelId).delete();
      const q = trx('task_labels').where('label_id', labelId);
      if (tenantId) q.andWhere('tenant_id', tenantId);
      return q.delete();
    });
  },

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

  async removeLabelAssignment(taskId, labelId) {
    return db('task_label_assignments')
      .where({
        task_id: taskId,
        label_id: labelId,
      })
      .delete();
  },

  async getLabelsForTask(taskId, tenantId = null) {
    const query = db('task_labels as l')
      .join('task_label_assignments as a', 'l.label_id', 'a.label_id')
      .select(['l.label_id', 'l.tenant_id', 'l.project_id', 'l.name', 'l.color', 'l.created_at'])
      .where('a.task_id', taskId);
    if (tenantId) query.andWhere('l.tenant_id', tenantId);
    return query;
  },
};

export default labelModel;
