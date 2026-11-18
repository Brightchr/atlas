import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** Drizzle schema — a typed MIRROR of the applied SQL migrations in
 * migrations.ts, which remain the source of truth and the only thing that
 * changes the database. When adding a migration, update this file to match;
 * drizzle-kit is not used to generate or run DDL.
 *
 * Timestamps use mode 'date' (node-postgres returns Date objects); they
 * serialize to ISO strings in c.json() exactly as before. */

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),
    /** NULL for Google-only accounts (migration 019). */
    passwordHash: text('password_hash'),
    role: text('role', { enum: ['user', 'moderator', 'admin'] }).notNull().default('user'),
    plan: text('plan', { enum: ['free', 'pro'] }).notNull().default('free'),
    planExpiresAt: timestamptz('plan_expires_at'),
    displayName: text('display_name'),
    bio: text('bio').notNull().default(''),
    profile: jsonb('profile').notNull().default({}),
    lastSeenAt: timestamptz('last_seen_at'),
    trialEndsAt: timestamptz('trial_ends_at').default(sql`now() + interval '7 days'`),
    status: text('status', { enum: ['active', 'banned'] }).notNull().default('active'),
    bannedAt: timestamptz('banned_at'),
    banReason: text('ban_reason'),
    comped: boolean('comped').notNull().default(false),
    googleId: text('google_id').unique(),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id'),
    emailVerified: boolean('email_verified').notNull().default(false),
    deletedAt: timestamptz('deleted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    impersonatorUserId: uuid('impersonator_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ip: text('ip'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at').notNull(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    read: boolean('read').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.read)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    detail: jsonb('detail').notNull().default({}),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('audit_log_actor_idx').on(t.actorId, t.createdAt)],
);

export const promotions = pgTable('promotions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  description: text('description').notNull().default(''),
  discountPercent: integer('discount_percent').notNull(),
  active: boolean('active').notNull().default(true),
  startsAt: timestamptz('starts_at').notNull().defaultNow(),
  endsAt: timestamptz('ends_at'),
  maxRedemptions: integer('max_redemptions'),
  grantDays: integer('grant_days'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

export const promoRedemptions = pgTable(
  'promo_redemptions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    promotionId: uuid('promotion_id')
      .notNull()
      .references(() => promotions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('promo_redemptions_promotion_id_user_id_key').on(t.promotionId, t.userId)],
);

export const sharedPlans = pgTable(
  'shared_plans',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localPlanId: text('local_plan_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    visibility: text('visibility', { enum: ['private', 'friends', 'public'] })
      .notNull()
      .default('private'),
    difficulty: text('difficulty', { enum: ['beginner', 'intermediate', 'advanced'] })
      .notNull()
      .default('intermediate'),
    goal: text('goal', { enum: ['build_muscle', 'lose_weight', 'get_stronger', 'general'] })
      .notNull()
      .default('general'),
    diet: text('diet', { enum: ['high_protein', 'calorie_deficit', 'balanced', 'performance'] }),
    payload: jsonb('payload').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shared_plans_owner_user_id_local_plan_id_key').on(t.ownerUserId, t.localPlanId),
    index('shared_plans_visibility_idx').on(t.visibility, t.updatedAt),
  ],
);

export const planReviews = pgTable(
  'plan_reviews',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    planId: uuid('plan_id')
      .notNull()
      .references(() => sharedPlans.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull().default(''),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('plan_reviews_plan_id_user_id_key').on(t.planId, t.userId)],
);

export const planShares = pgTable(
  'plan_shares',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    planId: uuid('plan_id')
      .notNull()
      .references(() => sharedPlans.id, { onDelete: 'cascade' }),
    fromUserId: uuid('from_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    toUserId: uuid('to_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('plan_shares_plan_id_to_user_id_key').on(t.planId, t.toUserId)],
);

export const syncRows = pgTable(
  'sync_rows',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    entity: text('entity').notNull(),
    rowId: text('row_id').notNull(),
    payload: jsonb('payload'),
    deleted: boolean('deleted').notNull().default(false),
    changedAt: timestamptz('changed_at').notNull(),
    deviceId: text('device_id').notNull(),
    seq: bigint('seq', { mode: 'number' }).notNull().default(sql`nextval('sync_rows_seq')`),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.entity, t.rowId] }),
    index('sync_rows_user_seq_idx').on(t.userId, t.seq),
  ],
);

export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'accepted'] }).notNull().default('pending'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    respondedAt: timestamptz('responded_at'),
  },
  (t) => [uniqueIndex('friendships_requester_id_addressee_id_key').on(t.requesterId, t.addresseeId)],
);

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

export const groupMembers = pgTable(
  'group_members',
  {
    groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['invited', 'member'] }).notNull().default('invited'),
    shareStats: boolean('share_stats').notNull().default(true),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    joinedAt: timestamptz('joined_at'),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

export const statGrants = pgTable(
  'stat_grants',
  {
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    granteeUserId: uuid('grantee_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ownerUserId, t.granteeUserId] })],
);

export const userStats = pgTable('user_stats', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const ipBlocks = pgTable('ip_blocks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  ip: text('ip').notNull().unique(),
  reason: text('reason').notNull().default(''),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  expiresAt: timestamptz('expires_at'),
});

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    reporterUserId: uuid('reporter_user_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: text('target_type', {
      enum: ['user', 'plan', 'review', 'recipe', 'session', 'other'],
    }).notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason', {
      enum: ['spam', 'harassment', 'inappropriate', 'cheating', 'other'],
    }).notNull(),
    detail: text('detail').notNull().default(''),
    status: text('status', { enum: ['open', 'resolved', 'dismissed'] }).notNull().default('open'),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamptz('resolved_at'),
    resolutionNote: text('resolution_note').notNull().default(''),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('reports_status_idx').on(t.status, t.createdAt)],
);

export const curatedFoods = pgTable('curated_foods', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  brand: text('brand'),
  barcode: text('barcode'),
  kcal: real('kcal').notNull(),
  proteinG: real('protein_g').notNull().default(0),
  carbsG: real('carbs_g').notNull().default(0),
  fatG: real('fat_g').notNull().default(0),
  sugarG: real('sugar_g'),
  fiberG: real('fiber_g'),
  saturatedFatG: real('saturated_fat_g'),
  sodiumG: real('sodium_g'),
  servingName: text('serving_name'),
  servingGrams: real('serving_grams'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

export const sharedRecipes = pgTable(
  'shared_recipes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localRecipeId: text('local_recipe_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    servings: integer('servings').notNull(),
    kcalPerServing: integer('kcal_per_serving').notNull().default(0),
    payload: jsonb('payload').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shared_recipes_owner_user_id_local_recipe_id_key').on(
      t.ownerUserId,
      t.localRecipeId,
    ),
  ],
);

export const sharedSessions = pgTable(
  'shared_sessions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localSessionId: text('local_session_id').notNull(),
    name: text('name').notNull(),
    performedAt: timestamptz('performed_at').notNull(),
    durationSec: integer('duration_sec').notNull(),
    visibility: text('visibility', { enum: ['friends', 'public'] }).notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shared_sessions_owner_user_id_local_session_id_key').on(
      t.ownerUserId,
      t.localSessionId,
    ),
    index('shared_sessions_owner_perf_idx').on(t.ownerUserId, t.performedAt.desc()),
  ],
);

export const recipeReviews = pgTable(
  'recipe_reviews',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => sharedRecipes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull().default(''),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('recipe_reviews_recipe_id_user_id_key').on(t.recipeId, t.userId)],
);

export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  receivedAt: timestamptz('received_at').notNull().defaultNow(),
});

export const emailTokens = pgTable(
  'email_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose', { enum: ['password_reset', 'email_verify'] }).notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('email_tokens_user_idx').on(t.userId)],
);
