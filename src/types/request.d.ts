import { JWT_PAYLOAD } from "../utils/jwt.util";

declare global {
  namespace Express {
    interface Request {
      user: JWT_PAYLOAD;
    }
  }
}
