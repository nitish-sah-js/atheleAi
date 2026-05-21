import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { UsersRepository } from './users.repository';

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async getMe(userId: string) {
    const user = await this.repository.findActiveById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  sanitize(user: User): SafeUser {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
