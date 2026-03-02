/**
 * User API routes - Express-style endpoint definitions.
 */

import type { Request, Response, Router } from 'express';
import { UserService } from '../services/user-service.js';

export function registerUserRoutes(router: Router, userService: UserService): void {
  router.get('/api/users', async (_req: Request, res: Response) => {
    const users = await userService.listUsers();
    res.json(users);
  });

  router.get('/api/users/:id', async (req: Request, res: Response) => {
    const user = await userService.getUser(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  });

  router.post('/api/users', async (req: Request, res: Response) => {
    try {
      const { name, email } = req.body;
      const user = await userService.createUser(name, email);
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
}
