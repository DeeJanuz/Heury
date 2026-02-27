import { describe, it, expect } from 'vitest';
import { PatternType } from '@/domain/models/index.js';
import { extractColumnAccess } from '@/extraction/column-extractor.js';

describe('extractColumnAccess', () => {
  it('should extract Prisma findMany with select as read columns', () => {
    const code = 'prisma.user.findMany({ select: { id: true, name: true, email: true } })';
    const result = extractColumnAccess(code, PatternType.DATABASE_READ);
    expect(result).toBeDefined();
    expect(result!.read).toEqual(expect.arrayContaining(['id', 'name', 'email']));
  });

  it('should extract Prisma create with data as write columns', () => {
    const code = 'prisma.user.create({ data: { name: "John", email: "john@example.com" } })';
    const result = extractColumnAccess(code, PatternType.DATABASE_WRITE);
    expect(result).toBeDefined();
    expect(result!.write).toEqual(expect.arrayContaining(['name', 'email']));
  });

  it('should extract Prisma update as read (where) + write (data)', () => {
    const code = 'prisma.user.update({ where: { id: 1 }, data: { name: "Jane" } })';
    const result = extractColumnAccess(code, PatternType.DATABASE_WRITE);
    expect(result).toBeDefined();
    expect(result!.read).toEqual(expect.arrayContaining(['id']));
    expect(result!.write).toEqual(expect.arrayContaining(['name']));
  });

  it('should extract SQL SELECT columns', () => {
    const code = "SELECT name, email, age FROM users WHERE id = 1";
    const result = extractColumnAccess(code, PatternType.DATABASE_READ);
    expect(result).toBeDefined();
    expect(result!.read).toEqual(expect.arrayContaining(['name', 'email', 'age']));
  });

  it('should extract SQL INSERT columns', () => {
    const code = "INSERT INTO users (name, email, age) VALUES ('John', 'j@e.com', 30)";
    const result = extractColumnAccess(code, PatternType.DATABASE_WRITE);
    expect(result).toBeDefined();
    expect(result!.write).toEqual(expect.arrayContaining(['name', 'email', 'age']));
  });

  it('should extract SQL UPDATE SET columns', () => {
    const code = "UPDATE users SET name = 'Jane', email = 'jane@e.com' WHERE id = 1";
    const result = extractColumnAccess(code, PatternType.DATABASE_WRITE);
    expect(result).toBeDefined();
    expect(result!.write).toEqual(expect.arrayContaining(['name', 'email']));
  });

  it('should extract SQL DELETE WHERE columns', () => {
    const code = "DELETE FROM users WHERE id = 1 AND status = 'inactive'";
    const result = extractColumnAccess(code, PatternType.DATABASE_READ);
    expect(result).toBeDefined();
    expect(result!.read).toEqual(expect.arrayContaining(['id', 'status']));
  });

  it('should return wildcard for variable indirection', () => {
    const code = 'prisma.user.findMany(queryOptions)';
    const result = extractColumnAccess(code, PatternType.DATABASE_READ);
    expect(result).toBeDefined();
    expect(result!.read).toEqual(['*']);
  });

  it('should return undefined for unsupported patterns', () => {
    const code = 'TypeORM find something';
    const result = extractColumnAccess(code, PatternType.DATABASE_READ);
    expect(result).toBeUndefined();
  });

  it('should return wildcard for no args', () => {
    const code = 'prisma.user.findMany()';
    const result = extractColumnAccess(code, PatternType.DATABASE_READ);
    expect(result).toBeDefined();
    expect(result!.read).toEqual(['*']);
  });
});
