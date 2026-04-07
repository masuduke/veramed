// ── Auth Routes ────────────────────────────────────────────────────
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '../auth/auth.service';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const authRouter = Router();

const passwordRules = body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .withMessage('Password must contain uppercase, lowercase, and a number');

authRouter.post('/register',
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  passwordRules,
  body('role').isIn(['patient', 'doctor', 'pharmacy', 'driver']),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const user = await AuthService.register(req.body);
    res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      userId: user.id,
      role: user.role,
    });
  }),
);

authRouter.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const tokens = await AuthService.login(req.body.email, req.body.password, req);
    res.json(tokens);
  }),
);

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
  const tokens = await AuthService.refresh(refreshToken);
  res.json(tokens);
}));

authRouter.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await AuthService.logout(req.user!.sub, req.body.refreshToken);
  res.json({ message: 'Logged out successfully' });
}));

authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, avatarUrl: true, status: true,
      patient: true, doctor: true, pharmacy: true, driver: true,
    },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));
