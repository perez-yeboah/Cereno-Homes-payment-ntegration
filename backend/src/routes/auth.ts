import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dev_key';

// Validation Schemas
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2)
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = RegisterSchema.parse(req.body);

    const existingUser = await prisma.adminUser.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.adminUser.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
