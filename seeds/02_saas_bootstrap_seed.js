import bcrypt from 'bcryptjs';
import env from '../src/config/env.js';
import { SYSTEM_PERMISSIONS } from '../src/constants/permissions.js';

/**
 * Idempotent SaaS Bootstrap Seed
 * Ensures subscription plans, global permissions catalog, and Platform Super Admin exist.
 */
export async function seed(knex) {
  // 1. Ensure permissions catalog
  for (const perm of SYSTEM_PERMISSIONS) {
    await knex('permissions').insert(perm).onConflict('permission_key').ignore();
  }

  // 2. Ensure subscription plans
  const plans = [
    {
      plan_name: 'Starter',
      description: 'Ideal for small teams getting started with Team Task Board.',
      max_employees: 15,
      max_projects: 10,
      price: 0,
      billing_cycle: 'monthly',
      is_active: true,
    },
    {
      plan_name: 'Professional',
      description: 'Built for growing engineering and product organizations.',
      max_employees: 75,
      max_projects: 50,
      price: 49.0,
      billing_cycle: 'monthly',
      is_active: true,
    },
    {
      plan_name: 'Business',
      description: 'Advanced workflows, unlimited collaboration, and custom roles.',
      max_employees: 250,
      max_projects: 200,
      price: 129.0,
      billing_cycle: 'monthly',
      is_active: true,
    },
    {
      plan_name: 'Enterprise',
      description: 'Large-scale multi-department workspace with generous limits.',
      max_employees: 1000,
      max_projects: 1000,
      price: 299.0,
      billing_cycle: 'monthly',
      is_active: true,
    },
  ];

  for (const plan of plans) {
    await knex('subscription_plans').insert(plan).onConflict('plan_name').ignore();
  }

  // 3. Ensure Platform Super Admin exists (never stored in tenant users table)
  const superAdminEmail = (env.SUPER_ADMIN_EMAIL || 'superadmin@teamtaskboard.app').trim().toLowerCase();
  const superAdminPassword = env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

  const existingSuperAdmin = await knex('super_admins')
    .whereRaw('LOWER(email) = ?', [superAdminEmail])
    .first();

  if (!existingSuperAdmin) {
    const password_hash = await bcrypt.hash(superAdminPassword, 12);
    await knex('super_admins').insert({
      full_name: 'Platform Super Admin',
      email: superAdminEmail,
      password_hash,
      is_active: true,
    });
  }
}
