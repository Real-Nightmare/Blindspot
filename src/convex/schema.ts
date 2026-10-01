import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // The Blindspot community — all app-level identity lives here.
  // `authUserId` links to the Better Auth user managed by the component.
  profiles: defineTable({
    authUserId: v.optional(v.string()),
    email: v.string(),
    fullName: v.string(),
    username: v.string(),
    role: v.union(
      v.literal("creator"),
      v.literal("admin"),
      v.literal("user"),
    ),
    // admin permission keys ("applications", "users", ...). Creator implied.
    permissions: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("suspended"),
      v.literal("banned"),
      v.literal("deleted"),
    ),
    avatarStorageId: v.optional(v.id("_storage")),
    bio: v.optional(v.string()),
    displayName: v.optional(v.string()),
    statusEmoji: v.optional(v.string()),
    statusText: v.optional(v.string()),
    rejectedReason: v.optional(v.string()),
    rejectionNote: v.optional(v.string()),
    // notification prefs
    notifyMessages: v.optional(v.boolean()),
    notifyMentions: v.optional(v.boolean()),
    notifyCalls: v.optional(v.boolean()),
    notifyGroups: v.optional(v.boolean()),
    notifyApprovals: v.optional(v.boolean()),
    notifyModeration: v.optional(v.boolean()),
    // privacy prefs
    allowDmFrom: v.optional(v.union(v.literal("everyone"), v.literal("nobody"))),
    allowGroupInvites: v.optional(v.boolean()),
    showOnline: v.optional(v.boolean()),
    showLastActive: v.optional(v.boolean()),
    showReadReceipts: v.optional(v.boolean()),
    showTyping: v.optional(v.boolean()),
    discoverable: v.optional(v.boolean()),
    quietMode: v.optional(v.boolean()),
    quietModeUntil: v.optional(v.number()),
    lastActiveAt: v.optional(v.number()),
    inviteCodeUsed: v.optional(v.string()),
    acceptedRulesVersion: v.optional(v.number()),
    acceptedRulesAt: v.optional(v.number()),
  })
    .index("authUserId", ["authUserId"])
    .index("email", ["email"])
    .index("username", ["username"])
    .index("status", ["status"])
    .index("role", ["role"])
    .index("status_role", ["status", "role"]),

  // Invite / access codes. The initial code "NIGHT" is seeded on first
  // registration attempt if absent.
  inviteCodes: defineTable({
    code: v.string(),
    active: v.boolean(),
    createdBy: v.optional(v.id("profiles")),
    uses: v.number(),
    lastUsedAt: v.optional(v.number()),
    note: v.optional(v.string()),
  }).index("code", ["code"]),

  // Audit trail for invitation code usage.
  inviteAudit: defineTable({
    code: v.string(),
    usedByProfile: v.optional(v.id("profiles")),
    usedByEmail: v.optional(v.string()),
    action: v.union(v.literal("validate"), v.literal("consume")),
    at: v.number(),
  }).index("code", ["code"]),

  rules: defineTable({
    order: v.number(),
    title: v.string(),
    body: v.string(),
    published: v.boolean(),
    disabled: v.boolean(),
    updatedBy: v.optional(v.id("profiles")),
  }).index("published", ["published"]),

  ruleVersions: defineTable({
    ruleId: v.id("rules"),
    version: v.number(),
    title: v.string(),
    body: v.string(),
    order: v.number(),
    published: v.boolean(),
    savedBy: v.optional(v.id("profiles")),
    savedAt: v.number(),
  }).index("ruleId", ["ruleId"]),

  ruleAcceptances: defineTable({
    userId: v.id("profiles"),
    version: v.number(),
    acceptedAt: v.number(),
  }).index("userId", ["userId"]),

  // Creator recovery codes (hashed). Shown once at generation time.
  recoveryCodes: defineTable({
    userId: v.id("profiles"),
    codeHash: v.string(),
    used: v.boolean(),
    createdAt: v.number(),
  }).index("userId", ["userId"]),

  applications: defineTable({
    userId: v.id("profiles"),
    state: v.union(
      v.literal("pending"),
      v.literal("interview_requested"),
      v.literal("interview_pending"),
      v.literal("interview_submitted"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    rejectionReason: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    reviewedBy: v.optional(v.id("profiles")),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("state", ["state"]),

  // Private verification material. Only creator / explicitly-authorized
  // staff may ever read these documents (see authz.ts).
  verification: defineTable({
    userId: v.id("profiles"),
    kind: v.union(
      v.literal("interview"),
      v.literal("material"),
    ),
    answers: v.optional(v.string()),
    fileIds: v.optional(v.array(v.id("_storage"))),
    fileName: v.optional(v.string()),
    note: v.optional(v.string()),
    requestedBy: v.optional(v.id("profiles")),
    requestedAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("profiles")),
    reviewedAt: v.optional(v.number()),
    state: v.union(
      v.literal("requested"),
      v.literal("submitted"),
      v.literal("reviewed"),
    ),
  })
    .index("userId", ["userId"])
    .index("state", ["state"]),

  // Explicit authorization to access verification data.
  verificationAccess: defineTable({
    adminUserId: v.id("profiles"),
    grantedBy: v.id("profiles"),
    grantedAt: v.number(),
  })
    .index("adminUserId", ["adminUserId"])
    .index("grantedBy", ["grantedBy"]),

  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    createdBy: v.id("profiles"),
    isPrivate: v.boolean(),
    // per-group privacy settings
    allowFiles: v.boolean(),
    allowVoice: v.boolean(),
    slowModeSeconds: v.optional(v.number()),
    disappearingSeconds: v.optional(v.number()),
    inviteOnly: v.boolean(),
    memberCount: v.number(),
  })
    .index("createdBy", ["createdBy"])
    .index("memberCount", ["memberCount"]),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("profiles"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
    state: v.union(v.literal("active"), v.literal("invited"), v.literal("banned")),
    invitedBy: v.optional(v.id("profiles")),
  })
    .index("groupId", ["groupId"])
    .index("userId", ["userId"])
    .index("groupId_userId", ["groupId", "userId"]),

  conversations: defineTable({
    kind: v.union(v.literal("dm"), v.literal("group"), v.literal("global")),
    // for DMs: sorted pair of user ids
    userA: v.optional(v.id("profiles")),
    userB: v.optional(v.id("profiles")),
    groupId: v.optional(v.id("groups")),
    lastMessageAt: v.optional(v.number()),
    lastMessagePreview: v.optional(v.string()),
    createdBy: v.optional(v.id("profiles")),
    // conversation-level settings
    disappearingSeconds: v.optional(v.number()),
    pinnedMessageIds: v.optional(v.array(v.id("messages"))),
  })
    .index("kind", ["kind"])
    .index("pair", ["userA", "userB"])
    .index("groupId", ["groupId"])
    .index("lastMessage", ["lastMessageAt"]),

  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("profiles"),
    lastReadAt: v.optional(v.number()),
    typingAt: v.optional(v.number()),
    blockedAt: v.optional(v.number()),
    joinedAt: v.number(),
    state: v.union(v.literal("active"), v.literal("left")),
  })
    .index("conversationId", ["conversationId"])
    .index("userId", ["userId"])
    .index("conversationId_userId", ["conversationId", "userId"])
    .index("userId_state", ["userId", "state"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    authorId: v.id("profiles"),
    body: v.optional(v.string()),
    kind: v.union(
      v.literal("text"),
      v.literal("image"),
      v.literal("file"),
      v.literal("voice"),
      v.literal("system"),
      v.literal("call"),
    ),
    replyToId: v.optional(v.id("messages")),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    // media
    attachmentId: v.optional(v.id("_storage")),
    attachmentName: v.optional(v.string()),
    attachmentType: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    // ephemeral
    expiresAt: v.optional(v.number()),
    // moderation
    removedBy: v.optional(v.id("profiles")),
    removedAt: v.optional(v.number()),
    // call metadata
    callMeta: v.optional(
      v.object({
        kind: v.union(v.literal("voice"), v.literal("video")),
        state: v.union(v.literal("started"), v.literal("ended"), v.literal("missed"), v.literal("declined")),
        durationSec: v.optional(v.number()),
      }),
    ),
  })
    .index("conversationId_creation", ["conversationId"])
    .index("authorId", ["authorId"])
    .index("expiresAt", ["expiresAt"]),

  reactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("profiles"),
    emoji: v.string(),
  })
    .index("messageId", ["messageId"])
    .index("messageId_userId", ["messageId", "userId"])
    .index("userId", ["userId"]),

  typing: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("profiles"),
    at: v.number(),
  })
    .index("conversationId", ["conversationId"])
    .index("conversationId_userId", ["conversationId", "userId"]),

  notifications: defineTable({
    userId: v.id("profiles"),
    kind: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    link: v.optional(v.string()),
    read: v.boolean(),
    actorId: v.optional(v.id("profiles")),
    createdAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("userId_read", ["userId", "read"]),

  reports: defineTable({
    reporterId: v.id("profiles"),
    targetType: v.union(
      v.literal("user"),
      v.literal("message"),
      v.literal("file"),
      v.literal("group"),
    ),
    targetId: v.string(),
    reason: v.string(),
    details: v.optional(v.string()),
    state: v.union(
      v.literal("open"),
      v.literal("reviewing"),
      v.literal("resolved"),
      v.literal("dismissed"),
    ),
    handledBy: v.optional(v.id("profiles")),
    handledAt: v.optional(v.number()),
    resolution: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("state", ["state"])
    .index("reporterId", ["reporterId"]),

  blocks: defineTable({
    blockerId: v.id("profiles"),
    blockedId: v.id("profiles"),
    createdAt: v.number(),
  })
    .index("blockerId", ["blockerId"])
    .index("blockerId_blockedId", ["blockerId", "blockedId"]),

  files: defineTable({
    storageId: v.id("_storage"),
    ownerId: v.id("profiles"),
    name: v.string(),
    type: v.string(),
    size: v.number(),
    visibility: v.union(v.literal("private"), v.literal("conversation")),
    conversationId: v.optional(v.id("conversations")),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("ownerId", ["ownerId"])
    .index("conversationId", ["conversationId"])
    .index("storageId", ["storageId"]),

  trustedContacts: defineTable({
    userId: v.id("profiles"),
    contactId: v.id("profiles"),
    createdAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("userId_contactId", ["userId", "contactId"]),

  // Creator-only integration settings. Secrets here are only ever returned
  // masked; writers must be the creator.
  integrations: defineTable({
    key: v.string(),
    label: v.string(),
    category: v.string(),
    enabled: v.boolean(),
    config: v.optional(v.any()),
    secrets: v.optional(v.any()),
    updatedBy: v.optional(v.id("profiles")),
    updatedAt: v.optional(v.number()),
  }).index("key", ["key"]),

  siteSettings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("key", ["key"]),

  auditLogs: defineTable({
    actorId: v.optional(v.id("profiles")),
    actorLabel: v.string(),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    summary: v.optional(v.string()),
    at: v.number(),
  })
    .index("actorId", ["actorId"])
    .index("action", ["action"])
    .index("at", ["at"]),

  calls: defineTable({
    conversationId: v.id("conversations"),
    initiatorId: v.id("profiles"),
    kind: v.union(v.literal("voice"), v.literal("video")),
    state: v.union(
      v.literal("ringing"),
      v.literal("active"),
      v.literal("ended"),
      v.literal("missed"),
      v.literal("declined"),
    ),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("conversationId", ["conversationId"])
    .index("state", ["state"]),

  aiBuilderRuns: defineTable({
    requestedBy: v.id("profiles"),
    prompt: v.string(),
    state: v.union(
      v.literal("draft"),
      v.literal("proposed"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("failed"),
    ),
    plan: v.optional(v.any()),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("requestedBy", ["requestedBy"])
    .index("state", ["state"]),

  rateLimits: defineTable({
    name: v.string(),
    key: v.string(),
    value: v.number(),
    ts: v.number(),
  }).index("name_key", ["name", "key"]),
});
