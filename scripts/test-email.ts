import "dotenv/config";
import path from "path";
import fs from "fs";
import { emailService } from "../src/utils/email";

const templatePath = path.join(__dirname, "../src/templates/verifyEmail.pug");
console.log("Template exists:", fs.existsSync(templatePath), templatePath);
console.log("EMAIL_HOST:", process.env.EMAIL_HOST);
console.log("EMAIL from:", process.env.EMAIL);

const start = Date.now();

emailService
  .sendEmailVerification({
    to: process.argv[2] ?? "test@example.com",
    name: "Test User",
    verificationUrl: "http://localhost:3000/verify-email?token=test-token",
  })
  .then(() => {
    console.log(`EMAIL_OK in ${Date.now() - start}ms`);
  })
  .catch((error) => {
    console.error(`EMAIL_FAIL in ${Date.now() - start}ms:`, error);
    process.exit(1);
  });
