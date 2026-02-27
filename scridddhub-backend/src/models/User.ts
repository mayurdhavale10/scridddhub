import { Db, Collection, ObjectId } from "mongodb";

export type UserRole = "owner" | "admin" | "staff";

export type UserDoc = {
  _id: ObjectId;
  email: string;

  passwordHash?: string;
  googleSub?: string;
  picture?: string; // from google

  name?: string;
  isVerified: boolean;
  requiresPasswordChange?: boolean;

  tenantId?: string;
  role: UserRole;

  createdAt: Date;
  updatedAt: Date;
};

// ✅ Insert type = same doc but WITHOUT _id
export type UserInsert = Omit<UserDoc, "_id">;

export type CreateUserInput = {
  email: string;
  passwordHash?: string;
  googleSub?: string;
  picture?: string;
  name?: string;
  tenantId?: string;
  role?: UserRole;
  isVerified?: boolean;
  requiresPasswordChange?: boolean;
};

const COLLECTION = "users";

export function usersCollection(db: Db): Collection<UserDoc> {
  return db.collection<UserDoc>(COLLECTION);
}

export async function ensureUserIndexes(db: Db) {
  const users = usersCollection(db);

  await users.createIndex(
    { email: 1 },
    { unique: true, name: "users_email_unique" }
  );

  await users.createIndex(
    { googleSub: 1 },
    { unique: true, sparse: true, name: "users_googleSub_unique" }
  );

  await users.createIndex(
    { tenantId: 1 },
    { name: "users_tenantId_idx" }
  );
}

export async function createUser(db: Db, input: CreateUserInput) {
  const users = usersCollection(db);

  const now = new Date();
  // Use explicit casting or OptionalId if available, but for now strict Omit is fine if we match the shape
  // actually, best to just let mongo handle _id
  const doc: any = {
    email: input.email.toLowerCase().trim(),
    passwordHash: input.passwordHash,
    googleSub: input.googleSub,
    picture: input.picture,
    name: input.name,
    tenantId: input.tenantId,
    role: input.role ?? "owner",
    isVerified: input.isVerified ?? false,
    requiresPasswordChange: input.requiresPasswordChange ?? false,
    createdAt: now,
    updatedAt: now,
  };

  const res = await users.insertOne(doc);
  return res.insertedId;
}
