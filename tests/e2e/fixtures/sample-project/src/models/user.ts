/**
 * User domain model.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly createdAt: Date = new Date(),
  ) {}

  displayName(): string {
    return `${this.name} <${this.email}>`;
  }

  isValid(): boolean {
    return this.name.length > 0 && this.email.includes('@');
  }
}
