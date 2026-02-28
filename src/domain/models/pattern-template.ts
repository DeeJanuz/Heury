import { randomUUID } from 'node:crypto';

export interface RepositoryPatternTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly patternTypes: string[];
  readonly templateUnitId: string;
  readonly templateFilePath: string;
  readonly followerCount: number;
  readonly conventions: string[];
}

export interface RepositoryPatternTemplateFollower {
  readonly templateId: string;
  readonly filePath: string;
  readonly unitName: string;
}

interface CreatePatternTemplateParams {
  id?: string;
  name: string;
  description: string;
  patternTypes: string[];
  templateUnitId: string;
  templateFilePath: string;
  followerCount: number;
  conventions: string[];
}

interface CreatePatternTemplateFollowerParams {
  templateId: string;
  filePath: string;
  unitName: string;
}

export function createPatternTemplate(params: CreatePatternTemplateParams): RepositoryPatternTemplate {
  if (!params.name) throw new Error('name must not be empty');
  if (!params.description) throw new Error('description must not be empty');
  if (!params.templateUnitId) throw new Error('templateUnitId must not be empty');
  if (!params.templateFilePath) throw new Error('templateFilePath must not be empty');
  if (params.followerCount < 0) throw new Error('followerCount must be >= 0');
  if (!Array.isArray(params.patternTypes)) throw new Error('patternTypes must be an array');
  if (!Array.isArray(params.conventions)) throw new Error('conventions must be an array');
  return {
    id: params.id ?? randomUUID(),
    name: params.name,
    description: params.description,
    patternTypes: [...params.patternTypes],
    templateUnitId: params.templateUnitId,
    templateFilePath: params.templateFilePath,
    followerCount: params.followerCount,
    conventions: [...params.conventions],
  };
}

export function createPatternTemplateFollower(params: CreatePatternTemplateFollowerParams): RepositoryPatternTemplateFollower {
  if (!params.templateId) throw new Error('templateId must not be empty');
  if (!params.filePath) throw new Error('filePath must not be empty');
  if (!params.unitName) throw new Error('unitName must not be empty');
  return {
    templateId: params.templateId,
    filePath: params.filePath,
    unitName: params.unitName,
  };
}
