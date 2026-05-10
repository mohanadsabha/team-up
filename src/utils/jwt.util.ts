import { verify, sign } from "jsonwebtoken";
import AppError from "../utils/appError";
import type { StringValue } from "ms";
import type { JwtPayload } from "jsonwebtoken";
import { randomUUID } from "crypto";

/*
 ** Make modifications to the JWT payload as needed.
 */
export interface JWT_PAYLOAD extends JwtPayload {
  userId: string;
  role: string;
}
const JWT_SECRET = process.env.JWT_SECRET;

export const signJWT = (payload: JWT_PAYLOAD) => {
  return sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_TTL as StringValue,
  });
};

export const verifyJWT = (token: string): Promise<JWT_PAYLOAD> => {
  return new Promise((resolve, reject) => {
    verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return reject(err);
      if (isJWT_PAYLOAD(decoded)) {
        resolve(decoded);
      } else {
        reject(new AppError("Invalid token payload", 400));
      }
    });
  });
};

function isJWT_PAYLOAD(obj: any): obj is JWT_PAYLOAD {
  return obj && typeof obj.role === "string" && typeof obj.userId === "string";
}
