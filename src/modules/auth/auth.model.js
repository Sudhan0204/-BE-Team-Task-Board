import db from '../../config/database.js';

export const SAFE_USER_COLUMNS = [
  'user_id',
  'tenant_id',
  'full_name',
  'email',
  'employee_code',
  'phone',
  'department',
  'designation',
  'avatar_url',
  'is_active',
  'email_verified',
  'created_at',
  'updated_at',
];

export const authModel = {
  /**
   * Find a user by email (legacy / fallback lookup)
   */
  async findByEmail(email, includePassword = false) {
    const columns = includePassword ? [...SAFE_USER_COLUMNS, 'password_hash'] : SAFE_USER_COLUMNS;
    return db('users')
      .select(columns)
      .whereRaw('LOWER(email) = ?', [email.trim().toLowerCase()])
      .first();
  },

  /**
   * Find all users across tenants matching an email (used to detect multi-tenant ambiguity on login)
   */
  async findAllByEmail(email, includePassword = false) {
    const columns = includePassword ? [...SAFE_USER_COLUMNS, 'password_hash'] : SAFE_USER_COLUMNS;
    return db('users')
      .select(columns)
      .whereRaw('LOWER(email) = ?', [email.trim().toLowerCase()]);
  },

  /**
   * Find a user strictly scoped to a specific tenant and email
   */
  async findByTenantAndEmail(tenantId, email, includePassword = false) {
    const columns = includePassword ? [...SAFE_USER_COLUMNS, 'password_hash'] : SAFE_USER_COLUMNS;
    return db('users')
      .select(columns)
      .where('tenant_id', tenantId)
      .whereRaw('LOWER(email) = ?', [email.trim().toLowerCase()])
      .first();
  },

  /**
   * Find a user by user_id returning safe fields only
   */
  async findById(userId) {
    return db('users')
      .select(SAFE_USER_COLUMNS)
      .where('user_id', userId)
      .first();
  },

  /**
   * Insert a new user into the users table within a tenant
   */
  async create({
    tenant_id,
    full_name,
    email,
    password_hash,
    avatar_url = null,
    employee_code = null,
    phone = null,
    department = null,
    designation = null,
  }) {
    const [user] = await db('users')
      .insert({
        tenant_id,
        full_name,
        email,
        password_hash,
        avatar_url,
        employee_code,
        phone,
        department,
        designation,
        is_active: true,
        email_verified: false,
      })
      .returning(SAFE_USER_COLUMNS);
    return user;
  },

  /**
   * Creates a hashed password reset token in password_reset_tokens
   */
  async createResetToken({ user_id, token_hash, expires_at }) {
    const [tokenRecord] = await db('password_reset_tokens')
      .insert({
        user_id,
        token_hash,
        expires_at,
      })
      .returning(['token_id', 'user_id', 'expires_at', 'created_at']);
    return tokenRecord;
  },

  /**
   * Finds an active, unexpired, and unused password reset token by its cryptographic hash
   */
  async findValidResetToken(token_hash) {
    return db('password_reset_tokens')
      .select(['token_id', 'user_id', 'expires_at', 'used_at'])
      .where('token_hash', token_hash)
      .whereNull('used_at')
      .where('expires_at', '>', db.fn.now())
      .first();
  },

  /**
   * Atomically updates user password and marks the reset token as consumed within a database transaction
   */
  async consumeResetTokenAndUpdatePassword({ token_id, user_id, password_hash }) {
    return db.transaction(async (trx) => {
      const updatedTokens = await trx('password_reset_tokens')
        .where('token_id', token_id)
        .whereNull('used_at')
        .update({
          used_at: trx.fn.now(),
        });

      if (updatedTokens === 0) {
        throw new Error('Reset token has already been used or is invalid');
      }

      const [updatedUser] = await trx('users')
        .where('user_id', user_id)
        .update({
          password_hash,
          updated_at: trx.fn.now(),
        })
        .returning(SAFE_USER_COLUMNS);

      return updatedUser;
    });
  },
};

export default authModel;
