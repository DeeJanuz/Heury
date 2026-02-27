import { randomUUID } from 'node:crypto';

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

export interface ApiEndpointSpec {
  readonly id: string;
  readonly patternId: string;
  readonly httpMethod: HttpMethod;
  readonly routePath: string;
  readonly requestBodySchema?: Record<string, unknown>;
  readonly responseSchema?: Record<string, unknown>;
  readonly queryParams?: Record<string, unknown>;
  readonly pathParams: string[];
  readonly middlewareChain: string[];
  readonly authRequired: boolean;
}

interface CreateApiEndpointSpecParams {
  id?: string;
  patternId: string;
  httpMethod: HttpMethod;
  routePath: string;
  requestBodySchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  queryParams?: Record<string, unknown>;
  pathParams?: string[];
  middlewareChain?: string[];
  authRequired?: boolean;
}

export function createApiEndpointSpec(params: CreateApiEndpointSpecParams): ApiEndpointSpec {
  if (!params.patternId) {
    throw new Error('patternId must not be empty');
  }
  if (!params.routePath) {
    throw new Error('routePath must not be empty');
  }

  return {
    id: params.id ?? randomUUID(),
    patternId: params.patternId,
    httpMethod: params.httpMethod,
    routePath: params.routePath,
    requestBodySchema: params.requestBodySchema,
    responseSchema: params.responseSchema,
    queryParams: params.queryParams,
    pathParams: params.pathParams ?? [],
    middlewareChain: params.middlewareChain ?? [],
    authRequired: params.authRequired ?? false,
  };
}
