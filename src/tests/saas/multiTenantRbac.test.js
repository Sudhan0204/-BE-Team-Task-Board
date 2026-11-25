import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../app.js';
import db from '../../config/database.js';
import env from '../../config/env.js';

const RUN_ID = Date.now().toString().slice(-6);
const KOVAI_SLUG = `kovai-test-${RUN_ID}`;
const BRIGHT_SLUG = `brightui-test-${RUN_ID}`;

// Minimal valid 1x1 PNG binary for real Multer logo upload testing
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('Multi-Tenant SaaS & Dynamic RBAC End-to-End Integration Suite', () => {
  let superAdminToken = '';
  let kovaiTenantId = '';
  let kovaiLogoPath = '';
  let brightTenantId = '';

  let kovaiAdminToken = '';
  let kovaiAdminUserId = '';
  let brightAdminToken = '';
  let brightEmployeeId = '';

  let managerRoleId = '';
  let teamLeadRoleId = '';
  let developerRoleId = '';
  let testerRoleId = '';

  let arunId = '';
  let priyaId = '';
  let sudharsanId = '';
  let karthikId = '';

  let arunToken = '';
  let priyaToken = '';
  let sudharsanToken = '';
  let karthikToken = '';

  let kovaiProjectId = '';
  let kovaiTaskId = '';

  beforeAll(async () => {
    // Ensure bootstrap seed is active (super admin exists)
    const sa = await db('super_admins').first();
    expect(sa).toBeTruthy();
  });

  afterAll(async () => {
    // Clean up test tenants (ON DELETE CASCADE removes all tenant-owned users, roles, projects, tasks)
    const ids = [kovaiTenantId, brightTenantId].filter(Boolean);
    if (ids.length > 0) {
      // Delete user_roles first (roles FK is ON DELETE RESTRICT)
      await db('user_roles').whereIn('tenant_id', ids).delete();
      await db('tenants').whereIn('tenant_id', ids).delete();
    }
    if (kovaiLogoPath && fs.existsSync(kovaiLogoPath)) {
      try {
        fs.unlinkSync(kovaiLogoPath);
      } catch {
        // ignore
      }
    }
  });

  it('Step 1: Super Admin logs in, views platform dashboard, and rejects invalid credentials', async () => {
    const badRes = await request(app)
      .post('/api/super-admin/login')
      .send({ email: env.SUPER_ADMIN_EMAIL, password: 'WrongPassword!' });
    expect(badRes.status).toBe(401);

    const res = await request(app)
      .post('/api/super-admin/login')
      .send({ email: env.SUPER_ADMIN_EMAIL, password: env.SUPER_ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    superAdminToken = res.body.data.token;

    const dashRes = await request(app)
      .get('/api/super-admin/dashboard')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.totalCompanies).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(dashRes.body.data.subscriptionOverview)).toBe(true);
  });

  it('Steps 2–4: Super Admin creates Kovai.co with uploaded logo & BrightUI Technologies independently', async () => {
    const kovaiRes = await request(app)
      .post('/api/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .field('company_name', 'Kovai.co')
      .field('slug', KOVAI_SLUG)
      .field('email', `contact-${RUN_ID}@kovai.co`)
      .field('website', 'https://kovai.co')
      .field('description', 'Enterprise SaaS Engineering')
      .field('admin_full_name', 'Saravana Admin')
      .field('admin_email', `admin-${RUN_ID}@kovai.co`)
      .field('admin_password', 'KovaiAdmin@123')
      .field('max_employees', '50')
      .field('max_projects', '25')
      .attach('logo', TINY_PNG_BUFFER, { filename: 'kovai-logo.png', contentType: 'image/png' });

    expect(kovaiRes.status).toBe(201);
    expect(kovaiRes.body.data.tenant.slug).toBe(KOVAI_SLUG);
    expect(kovaiRes.body.data.tenant.logo_url).toContain('/uploads/logos/');
    kovaiTenantId = String(kovaiRes.body.data.tenant.tenant_id);
    kovaiAdminUserId = String(kovaiRes.body.data.admin.user_id);

    const logoFilename = path.basename(kovaiRes.body.data.tenant.logo_url);
    kovaiLogoPath = path.resolve(process.cwd(), 'uploads', 'logos', logoFilename);
    expect(fs.existsSync(kovaiLogoPath)).toBe(true);

    // Duplicate slug rejected with 409
    const dupRes = await request(app)
      .post('/api/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        company_name: 'Kovai Duplicate',
        slug: KOVAI_SLUG,
        email: `dup-${RUN_ID}@kovai.co`,
        admin_full_name: 'Dup Admin',
        admin_email: `dupadmin-${RUN_ID}@kovai.co`,
        admin_password: 'Password@123',
      });
    expect(dupRes.status).toBe(409);

    // Create Tenant B: BrightUI Technologies
    const brightRes = await request(app)
      .post('/api/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        company_name: 'BrightUI Technologies',
        slug: BRIGHT_SLUG,
        email: `hello-${RUN_ID}@brightui.io`,
        admin_full_name: 'Bright Admin',
        admin_email: `admin-${RUN_ID}@brightui.io`,
        admin_password: 'BrightAdmin@123',
      });
    expect(brightRes.status).toBe(201);
    brightTenantId = String(brightRes.body.data.tenant.tenant_id);
    brightEmployeeId = String(brightRes.body.data.admin.user_id);

    // Public branding lookup serves logo & company name
    const brandRes = await request(app).get(`/api/tenants/public/${KOVAI_SLUG}`);
    expect(brandRes.status).toBe(200);
    expect(brandRes.body.data.tenant.company_name).toBe('Kovai.co');
    expect(brandRes.body.data.tenant.logo_url).toContain('/uploads/logos/');
  });

  it('Steps 5–6: Company Admins log in, see isolated branding/dashboard, and cannot access Super Admin APIs', async () => {
    const kLogin = await request(app)
      .post(`/api/admin/login?tenant=${KOVAI_SLUG}`)
      .send({ email: `admin-${RUN_ID}@kovai.co`, password: 'KovaiAdmin@123' });
    expect(kLogin.status).toBe(200);
    expect(kLogin.body.data.tenant.company_name).toBe('Kovai.co');
    expect(kLogin.body.data.tenant.logo_url).toContain('/uploads/logos/');
    expect(kLogin.body.data.permissions.length).toBeGreaterThanOrEqual(20);
    kovaiAdminToken = kLogin.body.data.token;

    const bLogin = await request(app)
      .post(`/api/admin/login?tenant=${BRIGHT_SLUG}`)
      .send({ email: `admin-${RUN_ID}@brightui.io`, password: 'BrightAdmin@123' });
    expect(bLogin.status).toBe(200);
    expect(bLogin.body.data.tenant.company_name).toBe('BrightUI Technologies');
    brightAdminToken = bLogin.body.data.token;

    // Company Admin CANNOT access Super Admin endpoints
    const privEsc = await request(app)
      .get('/api/super-admin/dashboard')
      .set('Authorization', `Bearer ${kovaiAdminToken}`);
    expect([401, 403]).toContain(privEsc.status);

    // Super Admin token CANNOT access tenant employees endpoint
    const reverseEsc = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect([401, 403]).toContain(reverseEsc.status);

    // Kovai.co Company Dashboard only shows Kovai.co metrics
    const dashRes = await request(app)
      .get('/api/dashboard/company')
      .set('Authorization', `Bearer ${kovaiAdminToken}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.company.company_name).toBe('Kovai.co');
    expect(dashRes.body.data.metrics.totalEmployees).toBe(1);
  });

  it('Steps 7–10: Dynamic tenant-specific roles, granular permissions, and employee assignments', async () => {
    // Create Manager, Team Lead, Developer, Tester roles inside Kovai.co
    const mkRole = (role_name, permission_keys) =>
      request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${kovaiAdminToken}`)
        .send({ role_name, description: `${role_name} role`, permission_keys });

    const rMgr = await mkRole('Manager', [
      'dashboard.view',
      'employees.view',
      'projects.view',
      'projects.create',
      'projects.update',
      'tasks.view',
      'tasks.create',
      'tasks.update',
      'tasks.delete',
      'tasks.assign',
      'reports.view',
    ]);
    expect(rMgr.status).toBe(201);
    managerRoleId = String(rMgr.body.data.role.role_id);

    const rLead = await mkRole('Team Lead', [
      'dashboard.view',
      'projects.view',
      'tasks.view',
      'tasks.create',
      'tasks.update',
      'tasks.assign',
      'comments.create',
    ]);
    expect(rLead.status).toBe(201);
    teamLeadRoleId = String(rLead.body.data.role.role_id);

    const rDev = await mkRole('Developer', [
      'dashboard.view',
      'projects.view',
      'tasks.view',
      'tasks.update',
      'comments.create',
      'comments.update',
    ]);
    expect(rDev.status).toBe(201);
    developerRoleId = String(rDev.body.data.role.role_id);

    const rTest = await mkRole('Tester', [
      'dashboard.view',
      'projects.view',
      'tasks.view',
      'tasks.update',
      'comments.create',
    ]);
    expect(rTest.status).toBe(201);
    testerRoleId = String(rTest.body.data.role.role_id);

    // Duplicate role name within SAME tenant rejected (409)
    const dupRole = await mkRole('Developer', ['dashboard.view']);
    expect(dupRole.status).toBe(409);

    // Another tenant (BrightUI) CAN independently create a role named "Developer"
    const brightRole = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${brightAdminToken}`)
      .send({ role_name: 'Developer', permission_keys: ['dashboard.view', 'projects.view'] });
    expect(brightRole.status).toBe(201);

    // Create Kovai.co employees: Arun, Priya, Sudharsan, Karthik
    const mkEmp = (full_name, emailPrefix, department, roleId) =>
      request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${kovaiAdminToken}`)
        .send({
          full_name,
          email: `${emailPrefix}-${RUN_ID}@kovai.co`,
          password: 'Employee@123',
          department,
          designation: department,
          role_ids: [roleId],
        });

    const eArun = await mkEmp('Arun', 'arun', 'Development', managerRoleId);
    const ePriya = await mkEmp('Priya', 'priya', 'Development', teamLeadRoleId);
    const eSudharsan = await mkEmp('Sudharsan', 'sudharsan', 'Development', developerRoleId);
    const eKarthik = await mkEmp('Karthik', 'karthik', 'Testing', testerRoleId);

    expect(eArun.status).toBe(201);
    expect(ePriya.status).toBe(201);
    expect(eSudharsan.status).toBe(201);
    expect(eKarthik.status).toBe(201);

    arunId = String(eArun.body.data.employee.user_id);
    priyaId = String(ePriya.body.data.employee.user_id);
    sudharsanId = String(eSudharsan.body.data.employee.user_id);
    karthikId = String(eKarthik.body.data.employee.user_id);

    // Cannot delete a role currently assigned to employees (409)
    const delAssignedRole = await request(app)
      .delete(`/api/roles/${developerRoleId}`)
      .set('Authorization', `Bearer ${kovaiAdminToken}`);
    expect(delAssignedRole.status).toBe(409);

    // Cannot deactivate last active Company Admin (400)
    const deactivateSelf = await request(app)
      .patch(`/api/employees/${kovaiAdminUserId}/status`)
      .set('Authorization', `Bearer ${kovaiAdminToken}`)
      .send({ is_active: false });
    expect(deactivateSelf.status).toBe(400);
  });

  it('Steps 11–16: Manager, Team Lead, Developer, and Tester workflow with strict RBAC enforcement', async () => {
    const loginEmp = async (emailPrefix) => {
      const res = await request(app)
        .post(`/api/auth/login?tenant=${KOVAI_SLUG}`)
        .send({ email: `${emailPrefix}-${RUN_ID}@kovai.co`, password: 'Employee@123' });
      expect(res.status).toBe(200);
      return res.body.data.token;
    };

    arunToken = await loginEmp('arun');
    priyaToken = await loginEmp('priya');
    sudharsanToken = await loginEmp('sudharsan');
    karthikToken = await loginEmp('karthik');

    // Step 11: Manager (Arun) creates project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${arunToken}`)
      .send({
        name: 'Document360 Core',
        project_key: 'DOC360',
        description: 'Kovai flagship knowledge base',
      });
    expect(projRes.status).toBe(201);
    kovaiProjectId = String(projRes.body.data.project.project_id);

    // Step 12: Manager adds Priya, Sudharsan, Karthik as project members
    for (const uid of [priyaId, sudharsanId, karthikId]) {
      const mRes = await request(app)
        .post(`/api/projects/${kovaiProjectId}/members`)
        .set('Authorization', `Bearer ${arunToken}`)
        .send({ user_id: uid, role: 'developer' });
      expect(mRes.status).toBe(201);
    }

    // Cross-tenant member injection MUST fail (BrightUI employee cannot be added to Kovai project)
    const crossMember = await request(app)
      .post(`/api/projects/${kovaiProjectId}/members`)
      .set('Authorization', `Bearer ${arunToken}`)
      .send({ user_id: brightEmployeeId, role: 'developer' });
    expect(crossMember.status).toBe(400);

    // Step 13: Team Lead (Priya) creates and assigns task to Developer (Sudharsan)
    const taskRes = await request(app)
      .post(`/api/projects/${kovaiProjectId}/tasks`)
      .set('Authorization', `Bearer ${priyaToken}`)
      .send({
        title: 'Implement Tenant Middleware',
        status: 'todo',
        priority: 'high',
        assigned_to: sudharsanId,
      });
    expect(taskRes.status).toBe(201);
    kovaiTaskId = String(taskRes.body.data.task.task_id);

    // Team Lead CANNOT access /api/employees (403)
    const leadEmpDenied = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${priyaToken}`);
    expect(leadEmpDenied.status).toBe(403);

    // Step 14: Developer (Sudharsan) moves task to in_progress -> in_review & comments
    const devMove = await request(app)
      .patch(`/api/tasks/${kovaiTaskId}/status`)
      .set('Authorization', `Bearer ${sudharsanToken}`)
      .send({ status: 'in_review' });
    expect(devMove.status).toBe(200);
    expect(devMove.body.data.task.status).toBe('in_review');

    const devComment = await request(app)
      .post(`/api/tasks/${kovaiTaskId}/comments`)
      .set('Authorization', `Bearer ${sudharsanToken}`)
      .send({ comment_text: 'Ready for QA verification!' });
    expect(devComment.status).toBe(201);

    // Developer CANNOT delete tasks (403), create projects (403), or self-assign roles (403)
    expect(
      (await request(app).delete(`/api/tasks/${kovaiTaskId}`).set('Authorization', `Bearer ${sudharsanToken}`)).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${sudharsanToken}`)
          .send({ name: 'Rogue', project_key: 'ROG' })
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .put(`/api/employees/${sudharsanId}/roles`)
          .set('Authorization', `Bearer ${sudharsanToken}`)
          .send({ role_ids: [managerRoleId] })
      ).status
    ).toBe(403);

    // Step 15: Tester (Karthik) reviews and marks task done, CANNOT create tasks (403)
    const testDone = await request(app)
      .patch(`/api/tasks/${kovaiTaskId}/status`)
      .set('Authorization', `Bearer ${karthikToken}`)
      .send({ status: 'done' });
    expect(testDone.status).toBe(200);
    expect(testDone.body.data.task.status).toBe('done');

    const testCreateDenied = await request(app)
      .post(`/api/projects/${kovaiProjectId}/tasks`)
      .set('Authorization', `Bearer ${karthikToken}`)
      .send({ title: 'Should fail' });
    expect(testCreateDenied.status).toBe(403);

    // Revoking permission takes effect immediately
    const revokeRes = await request(app)
      .put(`/api/roles/${testerRoleId}/permissions`)
      .set('Authorization', `Bearer ${kovaiAdminToken}`)
      .send({ permission_keys: ['dashboard.view', 'projects.view', 'tasks.view'] });
    expect(revokeRes.status).toBe(200);

    const revokedAttempt = await request(app)
      .patch(`/api/tasks/${kovaiTaskId}/status`)
      .set('Authorization', `Bearer ${karthikToken}`)
      .send({ status: 'in_progress' });
    expect(revokedAttempt.status).toBe(403);

    // Step 16: Manager views activity logs & company progress
    const actRes = await request(app)
      .get(`/api/projects/${kovaiProjectId}/activity`)
      .set('Authorization', `Bearer ${arunToken}`);
    expect(actRes.status).toBe(200);
    expect(actRes.body.data.activity.length).toBeGreaterThanOrEqual(2);
  });

  it('Step 17: Strict cross-tenant isolation & inactive tenant lock-out', async () => {
    // BrightUI Admin sees 0 Kovai projects and 0 Kovai employees
    const brightProjs = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${brightAdminToken}`);
    expect(brightProjs.status).toBe(200);
    expect(brightProjs.body.data.length).toBe(0);

    // Direct ID tampering across tenants returns 404 (never leaks Kovai data!)
    expect(
      (await request(app).get(`/api/projects/${kovaiProjectId}`).set('Authorization', `Bearer ${brightAdminToken}`)).status
    ).toBe(404);
    expect(
      (await request(app).get(`/api/tasks/${kovaiTaskId}`).set('Authorization', `Bearer ${brightAdminToken}`)).status
    ).toBe(404);
    expect(
      (await request(app).get(`/api/employees/${arunId}`).set('Authorization', `Bearer ${brightAdminToken}`)).status
    ).toBe(404);
    expect(
      (await request(app).get(`/api/roles/${managerRoleId}`).set('Authorization', `Bearer ${brightAdminToken}`)).status
    ).toBe(404);

    // Super Admin deactivates BrightUI -> login AND active token immediately rejected with 403!
    const deactivateRes = await request(app)
      .patch(`/api/tenants/${brightTenantId}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'inactive' });
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.tenant.status).toBe('inactive');

    const blockedToken = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${brightAdminToken}`);
    expect(blockedToken.status).toBe(403);

    const blockedLogin = await request(app)
      .post(`/api/admin/login?tenant=${BRIGHT_SLUG}`)
      .send({ email: `admin-${RUN_ID}@brightui.io`, password: 'BrightAdmin@123' });
    expect(blockedLogin.status).toBe(403);

    // Super Admin logout clears cookie
    const saLogout = await request(app).post('/api/super-admin/logout');
    expect(saLogout.status).toBe(200);
  });
});
