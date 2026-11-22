-- =============================================================================
-- DevFlow Database Schema - Full Creation Script
-- Database: devflow_db (PostgreSQL)
-- Run this script ONCE to create all 13 core tables.
-- =============================================================================

-- Create database (run as superuser if needed, or create manually first)
-- CREATE DATABASE devflow_db;

-- Connect to devflow_db before running the rest:
-- \c devflow_db

-- Drop tables in reverse dependency order (for clean re-runs in development)
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS task_label_assignments CASCADE;
DROP TABLE IF EXISTS task_activity_logs CASCADE;
DROP TABLE IF EXISTS task_attachments CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS task_labels CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =============================================================================
-- TABLE: users
-- =============================================================================
CREATE TABLE users (
    user_id         BIGSERIAL PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- =============================================================================
-- TABLE: organizations
-- =============================================================================
CREATE TABLE organizations (
    organization_id BIGSERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    slug            VARCHAR(180) NOT NULL UNIQUE,
    description     TEXT,
    created_by      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_created_by ON organizations(created_by);

-- =============================================================================
-- TABLE: organization_members
-- =============================================================================
CREATE TABLE organization_members (
    organization_member_id BIGSERIAL PRIMARY KEY,
    organization_id        BIGINT NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    user_id                BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role                   VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);

-- =============================================================================
-- TABLE: projects
-- =============================================================================
CREATE TABLE projects (
    project_id      BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    project_key     VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    start_date      DATE,
    due_date        DATE,
    created_by      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, project_key)
);

CREATE INDEX idx_projects_org_id ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_by ON projects(created_by);

-- =============================================================================
-- TABLE: project_members
-- =============================================================================
CREATE TABLE project_members (
    project_member_id BIGSERIAL PRIMARY KEY,
    project_id        BIGINT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id           BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role              VARCHAR(20) NOT NULL DEFAULT 'developer' CHECK (role IN ('lead', 'developer', 'viewer')),
    added_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

-- =============================================================================
-- TABLE: tasks
-- =============================================================================
CREATE TABLE tasks (
    task_id      BIGSERIAL PRIMARY KEY,
    project_id   BIGINT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    title        VARCHAR(250) NOT NULL,
    description  TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'backlog'
                 CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled')),
    priority     VARCHAR(10) NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_by   BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    assigned_to  BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    due_date     DATE,
    position     NUMERIC(15,5) NOT NULL DEFAULT 1000,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_position ON tasks(project_id, position);

-- =============================================================================
-- TABLE: task_comments
-- =============================================================================
CREATE TABLE task_comments (
    comment_id   BIGSERIAL PRIMARY KEY,
    task_id      BIGINT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    comment_text TEXT NOT NULL,
    edited_at    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_comments_user_id ON task_comments(user_id);

-- =============================================================================
-- TABLE: task_attachments
-- =============================================================================
CREATE TABLE task_attachments (
    attachment_id BIGSERIAL PRIMARY KEY,
    task_id       BIGINT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    uploaded_by   BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    file_name     VARCHAR(255) NOT NULL,
    file_url      TEXT NOT NULL,
    file_size     BIGINT,
    mime_type     VARCHAR(100),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_task_id ON task_attachments(task_id);

-- =============================================================================
-- TABLE: task_labels
-- =============================================================================
CREATE TABLE task_labels (
    label_id   BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    color      VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, name)
);

CREATE INDEX idx_labels_project_id ON task_labels(project_id);

-- =============================================================================
-- TABLE: task_label_assignments
-- =============================================================================
CREATE TABLE task_label_assignments (
    task_id  BIGINT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    label_id BIGINT NOT NULL REFERENCES task_labels(label_id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, label_id)
);

CREATE INDEX idx_label_assignments_task_id ON task_label_assignments(task_id);
CREATE INDEX idx_label_assignments_label_id ON task_label_assignments(label_id);

-- =============================================================================
-- TABLE: task_activity_logs
-- =============================================================================
CREATE TABLE task_activity_logs (
    activity_id BIGSERIAL PRIMARY KEY,
    task_id     BIGINT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    user_id     BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    action      VARCHAR(50) NOT NULL,
    old_value   JSONB,
    new_value   JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_task_id ON task_activity_logs(task_id);
CREATE INDEX idx_activity_user_id ON task_activity_logs(user_id);
CREATE INDEX idx_activity_created_at ON task_activity_logs(created_at DESC);

-- =============================================================================
-- TABLE: notifications
-- =============================================================================
CREATE TABLE notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    task_id         BIGINT REFERENCES tasks(task_id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);

-- =============================================================================
-- TABLE: password_reset_tokens
-- =============================================================================
CREATE TABLE password_reset_tokens (
    token_id   BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_reset_tokens_user_id ON password_reset_tokens(user_id);

-- =============================================================================
-- Seed: Default admin user (password: DevFlow@123)
-- You can update the password after first login via the reset flow.
-- =============================================================================
-- bcrypt hash for 'DevFlow@123' with 12 salt rounds:
-- $2b$12$K8X9kGj7mQlKpL4sH3rqvuWs5dFgJ8mNpR2qL7wE3sX4vH9cY6nZi
-- Note: Generate a fresh hash if you prefer a custom seed password.

-- Uncomment and customize to seed a test user:
-- INSERT INTO users (full_name, email, password_hash, is_active, email_verified)
-- VALUES (
--   'DevFlow Admin',
--   'admin@devflow.app',
--   '$2b$12$K8X9kGj7mQlKpL4sH3rqvuWs5dFgJ8mNpR2qL7wE3sX4vH9cY6nZi',
--   TRUE,
--   TRUE
-- );

-- Schema creation complete.
SELECT 'DevFlow schema created successfully.' AS status;
