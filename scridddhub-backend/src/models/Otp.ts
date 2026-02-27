import { Db, Collection, ObjectId } from "mongodb";

export type OtpPurpose = "signup" | "login" | "reset_password";

export type OtpDoc = {
  _id: ObjectId;

  identifier: string; // email or phone
  purpose: OtpPurpose;

  otpHash: string; // hashed OTP (never store raw OTP)
  attempts: number;

  expiresAt: Date; // TTL index uses this
  createdAt: Date;
};

const COLLECTION = "otp_codes";

export function otpCollection(db: Db): Collection<OtpDoc> {
  return db.collection<OtpDoc>(COLLECTION);
}

/**
 * TTL index auto-deletes expired OTP docs.
 */
export async function ensureOtpIndexes(db: Db) {
  const otps = otpCollection(db);

  // Prevent spamming many OTP docs for same identifier+purpose
  await otps.createIndex(
    { identifier: 1, purpose: 1 },
    { name: "otp_identifier_purpose_idx" }
  );

  // TTL index (MongoDB will delete docs after expiresAt)
  await otps.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "otp_ttl_expiresAt" }
  );
}
