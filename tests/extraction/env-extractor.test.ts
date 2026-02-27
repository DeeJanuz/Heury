import { describe, it, expect } from 'vitest';
import { extractEnvVariables, isEnvExampleFile } from '@/extraction/env-extractor.js';

describe('extractEnvVariables', () => {
  it('should parse basic VAR=value', () => {
    const content = 'DATABASE_URL=postgresql://localhost:5432/db';
    const vars = extractEnvVariables(content);
    expect(vars).toHaveLength(1);
    expect(vars[0].name).toBe('DATABASE_URL');
    expect(vars[0].hasDefault).toBe(true);
    expect(vars[0].lineNumber).toBe(1);
  });

  it('should detect empty value as no default', () => {
    const content = 'SECRET_KEY=';
    const vars = extractEnvVariables(content);
    expect(vars).toHaveLength(1);
    expect(vars[0].name).toBe('SECRET_KEY');
    expect(vars[0].hasDefault).toBe(false);
  });

  it('should capture comment descriptions from preceding lines', () => {
    const content = '# Database connection string\nDATABASE_URL=postgresql://localhost:5432/db';
    const vars = extractEnvVariables(content);
    expect(vars).toHaveLength(1);
    expect(vars[0].description).toBe('Database connection string');
  });

  it('should reset comments on blank lines', () => {
    const content = '# This is unrelated\n\nDATABASE_URL=postgresql://localhost:5432/db';
    const vars = extractEnvVariables(content);
    expect(vars).toHaveLength(1);
    expect(vars[0].description).toBeUndefined();
  });

  it('should parse multiple variables', () => {
    const content = 'DATABASE_URL=postgres://localhost\nSECRET_KEY=abc123\nDEBUG=';
    const vars = extractEnvVariables(content);
    expect(vars).toHaveLength(3);
    expect(vars[0].name).toBe('DATABASE_URL');
    expect(vars[1].name).toBe('SECRET_KEY');
    expect(vars[2].name).toBe('DEBUG');
    expect(vars[2].hasDefault).toBe(false);
  });

  it('should skip comment-only lines', () => {
    const content = '# Just a comment\n# Another comment';
    const vars = extractEnvVariables(content);
    expect(vars).toHaveLength(0);
  });

  it('should return empty array for empty content', () => {
    const vars = extractEnvVariables('');
    expect(vars).toHaveLength(0);
  });

  it('should join multi-line comments into description', () => {
    const content = '# Line one\n# Line two\nAPI_KEY=secret';
    const vars = extractEnvVariables(content);
    expect(vars).toHaveLength(1);
    expect(vars[0].description).toBe('Line one Line two');
  });
});

describe('isEnvExampleFile', () => {
  it('should detect .env.example', () => {
    expect(isEnvExampleFile('project/.env.example')).toBe(true);
  });

  it('should detect .env.sample', () => {
    expect(isEnvExampleFile('.env.sample')).toBe(true);
  });

  it('should detect .env.template', () => {
    expect(isEnvExampleFile('config/.env.template')).toBe(true);
  });

  it('should not detect .env (actual env file)', () => {
    expect(isEnvExampleFile('.env')).toBe(false);
  });

  it('should not detect random files', () => {
    expect(isEnvExampleFile('app.ts')).toBe(false);
  });
});
