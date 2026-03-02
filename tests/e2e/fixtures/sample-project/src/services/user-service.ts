/**
 * User service - handles user business logic.
 */

import { UserEntity } from '../models/user.js';

export interface UserRepository {
  findById(id: string): Promise<UserEntity | null>;
  save(user: UserEntity): Promise<void>;
  findAll(): Promise<UserEntity[]>;
}

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async getUser(id: string): Promise<UserEntity | null> {
    if (!id) {
      throw new Error('User ID is required');
    }
    return this.repo.findById(id);
  }

  async createUser(name: string, email: string): Promise<UserEntity> {
    const user = new UserEntity(crypto.randomUUID(), name, email);
    if (!user.isValid()) {
      throw new Error('Invalid user data');
    }
    await this.repo.save(user);
    return user;
  }

  async listUsers(): Promise<UserEntity[]> {
    return this.repo.findAll();
  }
}
