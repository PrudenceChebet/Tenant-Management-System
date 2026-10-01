import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError, validate } from "../lib/errors.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();

// Never send passwordHash back to the app.
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["TENANT", "LANDLORD"]),
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const data = validate(registerSchema, req.body);

  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new HttpError(409, "An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      passwordHash: await bcrypt.hash(data.password, 10),
    },
  });

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = validate(loginSchema, req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for "no such user" and "wrong password", so the API
  // doesn't reveal which emails have accounts.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "Wrong email or password");
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me  (who am I, and which unit do I live in?)
router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { unit: { include: { property: true } } },
  });
  if (!user) throw new HttpError(401, "Account no longer exists");

  res.json({
    ...publicUser(user),
    unit: user.unit
      ? { id: user.unit.id, label: user.unit.label, property: { id: user.unit.property.id, name: user.unit.property.name } }
      : null,
  });
});

export default router;
