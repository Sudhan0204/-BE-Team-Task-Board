# DevFlow Backend REST API

Production-ready, highly secure REST API backend for **DevFlow**, a team task management application inspired by Jira, Trello, and Linear. Built with Node.js, Express.js 5.x, Knex.js, and PostgreSQL.

---

## 1. System Architecture

```
devflow-backend/
├── src/
│   ├── app.js                          # Express 5 initialization, Helmet, CORS, logging & rate limits
│   ├── server.js                       # Port binding, DB health ping pre-flight & graceful shutdown
│   ├── config/
│   │   ├── env.js                      # Centralized environment variable loader and validator
│   │   ├── database.js                 # Knex client with BIGINT string parser & connection pool
│   │   ├── logger.js                   # Structured logger with automatic credential/secret masking
│   │   └── email.js                    # Nodemailer configuration for password recovery
│   ├── middleware/
│   │   ├── authenticate.js             # JWT bearer verification & active user identity binding
│   │   ├── authorize.js                # Multi-tenant RBAC: requireOrgMember, requireProjectAccess, requireTaskAccess
│   │   ├── validateRequest.js          # Zod schema request validation middleware
│   │   ├── errorHandler.js             # Centralized PostgreSQL error code mapper & sanitized response envelope
│   │   ├── notFound.js                 # 404 handler for unregistered routes
│   │   ├── rateLimiter.js              # General API and strict authentication rate limiters
│   │   └── requestLogger.js            # Morgan HTTP stream logger
│   ├── modules/
│   │   ├── auth/                       # Register, login, logout, me, forgot/reset password
│   │   ├── organizations/              # Organization CRUD, members, roles, project creation
│   │   ├── projects/                   # Project CRUD, members, unique keys, board & activity
│   │   ├── tasks/                      # Task CRUD, Kanban drag/drop positions, status triggers
│   │   ├── comments/                   # Threaded discussion with author/lead moderation
│   │   ├── labels/                     # Project labels with cross-project assignment guards
│   │   ├── attachments/                # Multer upload (10MB limit) with disk synchronization
│   │   ├── notifications/              # In-app inbox & automated assignment event triggers
│   │   └── dashboard/                  # SQL aggregate metrics (FILTER WHERE) & my-tasks
│   ├── routes/
│   │   ├── health.routes.js            # GET /api/v1/health
│   │   └── index.routes.js             # API v1 mount point & /api/v1/docs OpenAPI endpoint
│   ├── utils/
│   │   ├── ApiError.js                 # Standardized operational error class with HTTP status codes
│   │   ├── apiResponse.js              # Standard JSON envelope helpers
│   │   ├── asyncHandler.js             # Async error forwarder to next(err)
│   │   └── pagination.js               # Parameter parser with sort-column allowlists
│   ├── docs/
│   │   └── openapi.json                # Complete OpenAPI 3.0 specification
│   └── tests/
│       ├── auth/auth.test.js
│       ├── organizations/organization.test.js
│       ├── projects/project.test.js
│       ├── tasks/task.test.js
│       └── dashboard/dashboard.test.js
├── .env.example
├── .gitignore
├── knexfile.js
├── package.json
└── README.md
```

---

## 2. Verified Database Schema (`devflow_db`)

The backend connects directly to the existing PostgreSQL database schema. No tables or columns have been invented or altered.

| Table Name | Primary Key | Key Relationships / Fields | Key Constraints / Defaults |
| :--- | :--- | :--- | :--- |
| **`users`** | `user_id` (bigint) | `email`, `password_hash`, `full_name`, `avatar_url` | `is_active` (true), `email_verified` (false) |
| **`organizations`** | `organization_id` (bigint) | `created_by` ➔ `users.user_id`, `slug`, `name` | Unique slug, name (varchar 150) |
| **`organization_members`**| `organization_member_id` | `organization_id`, `user_id` | Roles: `owner`, `admin`, `member` |
| **`projects`** | `project_id` (bigint) | `organization_id`, `created_by` | Unique `project_key` per organization (varchar 20) |
| **`project_members`** | `project_member_id` | `project_id`, `user_id` | Roles: `lead`, `developer`, `viewer` |
| **`tasks`** | `task_id` (bigint) | `project_id`, `created_by`, `assigned_to` | `position` (numeric), `completed_at` trigger |
| **`task_comments`** | `comment_id` (bigint) | `task_id`, `user_id`, `comment_text` | Author / Lead edit rights |
| **`task_attachments`** | `attachment_id` (bigint) | `task_id`, `uploaded_by`, `file_name`, `file_url` | Multer 10MB limit, physical file deletion |
| **`task_labels`** | `label_id` (bigint) | `project_id`, `name`, `color` | Unique name per project, hex color code |
| **`task_label_assignments`**| (`task_id`, `label_id`)| Compound join table | Same-project validation |
| **`task_activity_logs`** | `activity_id` (bigint) | `task_id`, `user_id`, `action` | `old_value` (`jsonb`), `new_value` (`jsonb`) |
| **`notifications`** | `notification_id` | `user_id`, `task_id`, `title`, `message` | Scoped to recipient, unread counts |
| **`password_reset_tokens`**| `token_id` (bigint) | `user_id`, `token_hash`, `expires_at`, `used_at` | 32-byte crypto token SHA-256 hash |

---

## 3. Getting Started

### Prerequisites
- Node.js >= 20.0.0
- PostgreSQL instance running `devflow_db`

### Installation
```bash
cd devflow-backend
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your credentials:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/devflow_db
JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
FRONTEND_URL=http://localhost:3000
```

### Starting the Server
- **Development mode (with auto-reload):**
  ```bash
  npm run dev
  ```
- **Production mode:**
  ```bash
  npm start
  ```

### Running Automated Tests
```bash
npm run test
```

---

## 4. API Documentation & Interactive Exploration

- **OpenAPI 3.0 Specification**: Accessible live via `GET /api/v1/docs`
- **Health Check & Latency Ping**: `GET /api/v1/health`

---

## 5. Summary of Core REST Endpoints

### Authentication
- `POST /api/v1/auth/register` - Create user account (bcrypt salt 12) & issue JWT
- `POST /api/v1/auth/login` - Authenticate & issue JWT
- `POST /api/v1/auth/logout` - Invalidate session
- `GET  /api/v1/auth/me` - Current user profile
- `POST /api/v1/auth/forgot-password` - Generate cryptographic reset token
- `POST /api/v1/auth/reset-password` - Consume token & update password atomically

### Organizations & RBAC
- `POST   /api/v1/organizations` - Create organization (creator = owner)
- `GET    /api/v1/organizations` - List user's organizations
- `GET    /api/v1/organizations/:organizationId` - Retrieve organization
- `PATCH  /api/v1/organizations/:organizationId` - Update organization (admin/owner)
- `GET    /api/v1/organizations/:organizationId/members` - List organization members
- `POST   /api/v1/organizations/:organizationId/members` - Add member to organization
- `PATCH  /api/v1/organizations/:organizationId/members/:userId` - Update member role
- `DELETE /api/v1/organizations/:organizationId/members/:userId` - Remove member (last owner protected)

### Projects
- `POST   /api/v1/organizations/:organizationId/projects` - Create project with unique `project_key` (creator = lead)
- `GET    /api/v1/organizations/:organizationId/projects` - List projects (paginated)
- `GET    /api/v1/projects/:projectId` - Retrieve project details
- `PATCH  /api/v1/projects/:projectId` - Update project details (lead/admin)
- `DELETE /api/v1/projects/:projectId` - Delete project (lead/admin)
- `GET    /api/v1/projects/:projectId/members` - List project members
- `POST   /api/v1/projects/:projectId/members` - Add member (must belong to parent org)
- `PATCH  /api/v1/projects/:projectId/members/:userId` - Update project member role
- `DELETE /api/v1/projects/:projectId/members/:userId` - Remove member from project

### Tasks & Kanban Board
- `POST   /api/v1/projects/:projectId/tasks` - Create task with assignee validation
- `GET    /api/v1/projects/:projectId/tasks` - Filter tasks (status, priority, assignee, search, sort)
- `GET    /api/v1/projects/:projectId/board` - Kanban board grouped by status ordered by position
- `GET    /api/v1/projects/:projectId/activity` - Project audit trail
- `GET    /api/v1/tasks/:taskId` - Retrieve task details
- `PATCH  /api/v1/tasks/:taskId` - Update task details & record diff in activity logs
- `PATCH  /api/v1/tasks/:taskId/status` - Move status column & update `completed_at`
- `PATCH  /api/v1/tasks/:taskId/assignee` - Assign task & dispatch notification
- `PATCH  /api/v1/tasks/:taskId/position` - Reorder position for Kanban drag-and-drop
- `DELETE /api/v1/tasks/:taskId` - Delete task

### Comments, Labels & Attachments
- `POST   /api/v1/tasks/:taskId/comments` - Post comment
- `GET    /api/v1/tasks/:taskId/comments` - List comments (paginated)
- `PATCH  /api/v1/comments/:commentId` - Edit comment (author/lead only)
- `DELETE /api/v1/comments/:commentId` - Delete comment (author/lead only)
- `POST   /api/v1/projects/:projectId/labels` - Create label with hex color
- `GET    /api/v1/projects/:projectId/labels` - List project labels
- `POST   /api/v1/tasks/:taskId/labels/:labelId` - Assign label (enforces same project)
- `DELETE /api/v1/tasks/:taskId/labels/:labelId` - Remove label from task
- `POST   /api/v1/tasks/:taskId/attachments` - Upload file (Multer max 10MB)
- `GET    /api/v1/tasks/:taskId/attachments` - List attachments
- `DELETE /api/v1/attachments/:attachmentId` - Delete attachment & file from disk

### Notifications & Dashboard
- `GET    /api/v1/notifications` - List user notifications (paginated)
- `GET    /api/v1/notifications/unread-count` - Get unread count
- `PATCH  /api/v1/notifications/:id/read` - Mark notification as read
- `PATCH  /api/v1/notifications/read-all` - Mark all notifications as read
- `GET    /api/v1/dashboard/summary` - Aggregated stats (total projects, assigned, status breakdown, overdue)
- `GET    /api/v1/dashboard/my-tasks` - Tasks assigned to user across all accessible projects
