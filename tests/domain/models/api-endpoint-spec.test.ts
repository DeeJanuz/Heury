import { describe, it, expect } from 'vitest';
import {
  HttpMethod,
  createApiEndpointSpec,
  type ApiEndpointSpec,
} from '@/domain/models/api-endpoint-spec.js';

describe('HttpMethod enum', () => {
  it('should have all expected HTTP methods', () => {
    expect(HttpMethod.GET).toBe('GET');
    expect(HttpMethod.POST).toBe('POST');
    expect(HttpMethod.PUT).toBe('PUT');
    expect(HttpMethod.PATCH).toBe('PATCH');
    expect(HttpMethod.DELETE).toBe('DELETE');
    expect(HttpMethod.HEAD).toBe('HEAD');
    expect(HttpMethod.OPTIONS).toBe('OPTIONS');
  });

  it('should have exactly 7 members', () => {
    const values = Object.values(HttpMethod);
    expect(values).toHaveLength(7);
  });
});

describe('createApiEndpointSpec', () => {
  it('should create an endpoint spec with required fields and defaults', () => {
    const spec = createApiEndpointSpec({
      patternId: 'pattern-1',
      httpMethod: HttpMethod.GET,
      routePath: '/api/users',
    });

    expect(spec.patternId).toBe('pattern-1');
    expect(spec.httpMethod).toBe(HttpMethod.GET);
    expect(spec.routePath).toBe('/api/users');
    expect(spec.id).toBeDefined();
    expect(spec.pathParams).toEqual([]);
    expect(spec.middlewareChain).toEqual([]);
    expect(spec.authRequired).toBe(false);
  });

  it('should use provided id and optional fields', () => {
    const spec = createApiEndpointSpec({
      id: 'spec-1',
      patternId: 'pattern-1',
      httpMethod: HttpMethod.POST,
      routePath: '/api/users/:id',
      pathParams: ['id'],
      middlewareChain: ['auth', 'validate'],
      authRequired: true,
      requestBodySchema: { type: 'object' },
      responseSchema: { type: 'array' },
      queryParams: { limit: { type: 'number' } },
    });

    expect(spec.id).toBe('spec-1');
    expect(spec.pathParams).toEqual(['id']);
    expect(spec.middlewareChain).toEqual(['auth', 'validate']);
    expect(spec.authRequired).toBe(true);
    expect(spec.requestBodySchema).toEqual({ type: 'object' });
    expect(spec.responseSchema).toEqual({ type: 'array' });
    expect(spec.queryParams).toEqual({ limit: { type: 'number' } });
  });

  it('should throw when patternId is empty', () => {
    expect(() =>
      createApiEndpointSpec({
        patternId: '',
        httpMethod: HttpMethod.GET,
        routePath: '/api/users',
      })
    ).toThrow();
  });

  it('should throw when routePath is empty', () => {
    expect(() =>
      createApiEndpointSpec({
        patternId: 'pattern-1',
        httpMethod: HttpMethod.GET,
        routePath: '',
      })
    ).toThrow();
  });
});
