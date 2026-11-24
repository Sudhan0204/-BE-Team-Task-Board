import bcrypt from 'bcryptjs';

/**
 * Idempotent development seed.
 * Never deletes existing rows; only creates a demo user if no users exist yet.
 */
export async function seed(knex) {
  const existingUsers = await knex('users').count('user_id as count').first();
  if (Number(existingUsers?.count || 0) > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash('DevFlow@123', 12);

  await knex.transaction(async (trx) => {
    const [user] = await trx('users')
      .insert({
        full_name: 'DevFlow Admin',
        email: 'admin@devflow.app',
        password_hash: passwordHash,
        is_active: true,
        email_verified: true,
      })
      .returning(['user_id']);

    const [org] = await trx('organizations')
      .insert({
        name: 'DevFlow Engineering',
        slug: 'devflow-engineering',
        description: 'Default engineering workspace',
        created_by: user.user_id,
      })
      .returning(['organization_id']);

    await trx('organization_members').insert({
      organization_id: org.organization_id,
      user_id: user.user_id,
      role: 'owner',
    });

    const [project] = await trx('projects')
      .insert({
        organization_id: org.organization_id,
        name: 'Website Redesign',
        description: 'Core product engineering sprint board',
        project_key: 'DEV',
        status: 'active',
        created_by: user.user_id,
      })
      .returning(['project_id']);

    await trx('project_members').insert({
      project_id: project.project_id,
      user_id: user.user_id,
      role: 'project_manager',
    });
  });
}
