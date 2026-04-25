import { v2 as cloudinary } from "cloudinary";

const requiredCloudinaryEnvVars = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

const missingCloudinaryEnvVars = requiredCloudinaryEnvVars.filter(
  (key) => !process.env[key] || process.env[key]?.trim() === "",
);

if (missingCloudinaryEnvVars.length) {
  throw new Error(
    `Missing Cloudinary env vars: ${missingCloudinaryEnvVars.join(", ")}.`,
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
