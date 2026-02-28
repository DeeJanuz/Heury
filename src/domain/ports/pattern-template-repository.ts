import type { RepositoryPatternTemplate, RepositoryPatternTemplateFollower } from '@/domain/models/index.js';

export interface IPatternTemplateRepository {
  save(template: RepositoryPatternTemplate, followers: RepositoryPatternTemplateFollower[]): void;
  saveBatch(templates: Array<{ template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] }>): void;
  findById(id: string): { template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] } | undefined;
  findByPatternType(patternType: string): { template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] }[];
  findAll(): { template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] }[];
  clear(): void;
}
