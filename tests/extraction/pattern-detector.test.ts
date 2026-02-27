import { describe, it, expect } from 'vitest';
import { PatternType } from '@/domain/models/index.js';
import {
  detectPatterns,
  deriveNextJsApiPath,
  extractControllerPrefix,
  filterPatternsByType,
  groupPatternsByType,
} from '@/extraction/pattern-detector.js';
import { JavaScriptTypeScriptExtractor } from '@/extraction/languages/javascript-typescript.js';

const jsExtractor = new JavaScriptTypeScriptExtractor();
const jsRules = jsExtractor.getPatternRules();

describe('detectPatterns', () => {
  it('should detect Express API endpoints', () => {
    const code = "app.get('/users', handler);\nrouter.post('/users', createUser);";
    const patterns = detectPatterns(code, jsRules);
    const endpoints = patterns.filter(p => p.patternType === PatternType.API_ENDPOINT);
    expect(endpoints.length).toBeGreaterThanOrEqual(2);
    expect(endpoints.some(p => p.patternValue.includes('GET') && p.patternValue.includes('/users'))).toBe(true);
    expect(endpoints.some(p => p.patternValue.includes('POST') && p.patternValue.includes('/users'))).toBe(true);
  });

  it('should detect Next.js API routes via file path', () => {
    const code = 'export async function GET(request) {\n  return Response.json({ ok: true });\n}';
    const patterns = detectPatterns(code, jsRules, 'app/api/users/route.ts');
    const endpoints = patterns.filter(p => p.patternType === PatternType.API_ENDPOINT);
    expect(endpoints.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect fetch/axios API calls', () => {
    const code = "fetch('https://api.example.com/data');\naxios.get('/api/users');";
    const patterns = detectPatterns(code, jsRules);
    const calls = patterns.filter(p => p.patternType === PatternType.API_CALL);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect Prisma reads', () => {
    const code = 'const users = await prisma.user.findMany({ select: { id: true } });';
    const patterns = detectPatterns(code, jsRules);
    const reads = patterns.filter(p => p.patternType === PatternType.DATABASE_READ);
    expect(reads.length).toBeGreaterThanOrEqual(1);
    expect(reads[0].patternValue).toContain('prisma.user.find');
  });

  it('should detect Prisma writes', () => {
    const code = 'await prisma.user.create({ data: { name: "John" } });';
    const patterns = detectPatterns(code, jsRules);
    const writes = patterns.filter(p => p.patternType === PatternType.DATABASE_WRITE);
    expect(writes.length).toBeGreaterThanOrEqual(1);
    expect(writes[0].patternValue).toContain('prisma.user.create');
  });

  it('should detect SQL reads via shared patterns', () => {
    const code = "db.query('SELECT id, name FROM users WHERE active = true')";
    const patterns = detectPatterns(code, jsRules);
    const reads = patterns.filter(p => p.patternType === PatternType.DATABASE_READ);
    expect(reads.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect SQL writes via shared patterns', () => {
    const code = "db.query('INSERT INTO users (name) VALUES (?)')";
    const patterns = detectPatterns(code, jsRules);
    const writes = patterns.filter(p => p.patternType === PatternType.DATABASE_WRITE);
    expect(writes.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect external services (stripe, openai)', () => {
    const code = 'stripe.checkout.sessions.create({});\nopenai.chat.completions.create({});';
    const patterns = detectPatterns(code, jsRules);
    const services = patterns.filter(p => p.patternType === PatternType.EXTERNAL_SERVICE);
    expect(services.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect env variables (process.env.X)', () => {
    const code = 'const url = process.env.DATABASE_URL;\nconst key = process.env.API_KEY;';
    const patterns = detectPatterns(code, jsRules);
    const envVars = patterns.filter(p => p.patternType === PatternType.ENV_VARIABLE);
    expect(envVars.length).toBeGreaterThanOrEqual(2);
    expect(envVars.some(p => p.patternValue === 'DATABASE_URL')).toBe(true);
    expect(envVars.some(p => p.patternValue === 'API_KEY')).toBe(true);
  });

  it('should deduplicate same pattern', () => {
    const code = "app.get('/users', handler);\napp.get('/users', otherHandler);";
    const patterns = detectPatterns(code, jsRules);
    const endpoints = patterns.filter(p => p.patternType === PatternType.API_ENDPOINT);
    // Same endpoint pattern value should be deduplicated
    const uniqueValues = new Set(endpoints.map(p => p.patternValue));
    expect(endpoints.length).toBe(uniqueValues.size);
  });

  it('should return empty array for empty content', () => {
    const patterns = detectPatterns('', jsRules);
    expect(patterns).toHaveLength(0);
  });

  it('should record line numbers for matches', () => {
    const code = "// line 1\napp.get('/users', handler);";
    const patterns = detectPatterns(code, jsRules);
    const endpoints = patterns.filter(p => p.patternType === PatternType.API_ENDPOINT);
    expect(endpoints.length).toBeGreaterThanOrEqual(1);
    expect(endpoints[0].lineNumber).toBe(2);
  });
});

describe('deriveNextJsApiPath', () => {
  it('should derive path from app router file', () => {
    expect(deriveNextJsApiPath('app/api/users/route.ts')).toBe('/api/users');
  });

  it('should handle dynamic segments', () => {
    expect(deriveNextJsApiPath('app/api/users/[id]/route.ts')).toBe('/api/users/[id]');
  });

  it('should handle catch-all segments', () => {
    const result = deriveNextJsApiPath('app/api/auth/[...all]/route.ts');
    expect(result).toBe('/api/auth/*');
  });

  it('should return undefined for non-route files', () => {
    expect(deriveNextJsApiPath('src/utils/helper.ts')).toBeUndefined();
  });
});

describe('extractControllerPrefix', () => {
  it('should extract @Route prefix', () => {
    const code = "@Route('users')\nexport class UserController {}";
    expect(extractControllerPrefix(code)).toBe('/users');
  });

  it('should extract @Controller prefix with leading slash', () => {
    const code = "@Controller('/api/users')\nexport class UserController {}";
    expect(extractControllerPrefix(code)).toBe('/api/users');
  });

  it('should return undefined for no decorator', () => {
    expect(extractControllerPrefix('export class Foo {}')).toBeUndefined();
  });
});

describe('filterPatternsByType', () => {
  it('should filter patterns by type', () => {
    const patterns = [
      { patternType: PatternType.API_ENDPOINT, patternValue: 'GET /users', lineNumber: 1 },
      { patternType: PatternType.API_CALL, patternValue: 'https://api.com', lineNumber: 2 },
      { patternType: PatternType.API_ENDPOINT, patternValue: 'POST /users', lineNumber: 3 },
    ];
    const filtered = filterPatternsByType(patterns, PatternType.API_ENDPOINT);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(p => p.patternType === PatternType.API_ENDPOINT)).toBe(true);
  });
});

describe('groupPatternsByType', () => {
  it('should group patterns by type', () => {
    const patterns = [
      { patternType: PatternType.API_ENDPOINT, patternValue: 'GET /users', lineNumber: 1 },
      { patternType: PatternType.API_CALL, patternValue: 'https://api.com', lineNumber: 2 },
      { patternType: PatternType.API_ENDPOINT, patternValue: 'POST /users', lineNumber: 3 },
    ];
    const grouped = groupPatternsByType(patterns);
    expect(grouped.get(PatternType.API_ENDPOINT)).toHaveLength(2);
    expect(grouped.get(PatternType.API_CALL)).toHaveLength(1);
  });
});
