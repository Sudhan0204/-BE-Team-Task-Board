/**
 * Non-destructive additive migration:
 * Ensures the `task_attachments` table exists without altering or dropping any existing tables/data.
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('task_attachments');
  if (!exists) {
    await knex.schema.createTable('task_attachments', (table) => {
      table.bigIncrements('attachment_id').primary();
      table
        .bigInteger('task_id')
        .notNullable()
        .references('task_id')
        .inTable('tasks')
        .onDelete('CASCADE');
      table
        .bigInteger('uploaded_by')
        .notNullable()
        .references('user_id')
        .inTable('users')
        .onDelete('RESTRICT');
      table.string('file_name', 255).notNullable();
      table.text('file_url').notNullable();
      table.bigInteger('file_size');
      table.string('mime_type', 100);
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    await knex.raw(
      'CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON task_attachments(task_id)'
    );
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('task_attachments');
}
