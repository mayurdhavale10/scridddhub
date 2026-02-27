import bcrypt from "bcryptjs";

async function test() {
    try {
        const password = "password123";
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        console.log("Hash generated:", hash);

        const isValid = await bcrypt.compare(password, hash);
        console.log("Is valid (correct password):", isValid);

        const isInvalid = await bcrypt.compare("wrongpassword", hash);
        console.log("Is valid (wrong password):", isInvalid);
    } catch (e) {
        console.error("Bcrypt test failed", e);
    }
}

test();
