import jwt from "jsonwebtoken";
import { HttpError } from "../lib/errors.js";

const SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is missing from .env");
  return process.env.JWT_SECRET;
};

// Creates a signed token that the app sends back on every request.
// It holds only the user's id and role, never the password.
export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, SECRET(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// Checks the "Authorization: Bearer <token>" header.
// On success, req.user = { id, role } for the route handler to use.
export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "Please log in first"));
  }
  try {
    const payload = jwt.verify(token, SECRET());
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch {
    next(new HttpError(401, "Your session has expired, please log in again"));
  }
}

// Only lets the listed roles through, e.g. requireRole("LANDLORD").
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new HttpError(403, "You don't have permission to do this"));
    }
    next();
  };
}
