import { describe, it, expect } from 'vitest';
import {
  createEnvVariable,
  type RepositoryEnvVariable,
} from '@/domain/models/env-variable.js';

describe('createEnvVariable', () => {
  it('should create an env variable with required fields and defaults', () => {
    const envVar = createEnvVariable({
      name: 'DATABASE_URL',
      lineNumber: 5,
    });

    expect(envVar.name).toBe('DATABASE_URL');
    expect(envVar.lineNumber).toBe(5);
    expect(envVar.hasDefault).toBe(false);
    expect(envVar.id).toBeDefined();
  });

  it('should use provided id and optional fields', () => {
    const envVar = createEnvVariable({
      id: 'env-1',
      name: 'API_KEY',
      description: 'The API key for the external service',
      hasDefault: true,
      lineNumber: 12,
    });

    expect(envVar.id).toBe('env-1');
    expect(envVar.description).toBe('The API key for the external service');
    expect(envVar.hasDefault).toBe(true);
  });

  it('should throw when name is empty', () => {
    expect(() =>
      createEnvVariable({ name: '', lineNumber: 1 })
    ).toThrow();
  });

  it('should throw when lineNumber is less than 1', () => {
    expect(() =>
      createEnvVariable({ name: 'FOO', lineNumber: 0 })
    ).toThrow();
  });
});
