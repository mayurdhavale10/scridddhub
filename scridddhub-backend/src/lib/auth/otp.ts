import crypto from "crypto";

export function generateNumericOtp(length: number = 6): string {
    // Generate a random numeric string
    const digits = "0123456789";
    let otp = "";
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
}

export function hashOtp(otp: string): string {
    return crypto.createHash("sha256").update(otp).digest("hex");
}

export function verifyOtpHash(otp: string, hash: string): boolean {
    return hashOtp(otp) === hash;
}
