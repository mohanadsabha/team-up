import cloudinary from "../config/cloudinary";
import { UploadApiErrorResponse, UploadApiResponse } from "cloudinary";
import AppError from "./appError";

export const uploadImageToCloudinary = (
  file: Express.Multer.File,
  module: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `${module}s`,
        public_id: `${module}-${Date.now()}`,
        format: "jpeg",
        transformation: [{ width: 1280, height: 720, crop: "fill" }],
      },
      (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(new AppError("Image upload failed", 500));
        } else {
          resolve(result.secure_url);
        }
      },
    );
    uploadStream.end(file.buffer);
  });
};

export const deleteImageFromCloudinary = async (
  imageUrl: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const publicId = imageUrl.split("/").slice(-2).join("/").split(".")[0];
    if (!publicId) {
      throw new AppError("Invalid image URL provided", 400);
    }
    cloudinary.uploader.destroy(
      publicId,
      { invalidate: true },
      (error?: any, result?: any) => {
        if (error) {
          reject(new AppError("Image deletion failed", 500));
        } else {
          resolve();
        }
      },
    );
  });
};
