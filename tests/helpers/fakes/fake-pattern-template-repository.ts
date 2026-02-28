import type { RepositoryPatternTemplate, RepositoryPatternTemplateFollower } from '@/domain/models/index.js';
import type { IPatternTemplateRepository } from '@/domain/ports/index.js';

export class InMemoryPatternTemplateRepository implements IPatternTemplateRepository {
  private readonly templates = new Map<string, RepositoryPatternTemplate>();
  private readonly followers = new Map<string, RepositoryPatternTemplateFollower[]>();

  save(template: RepositoryPatternTemplate, templateFollowers: RepositoryPatternTemplateFollower[]): void {
    this.templates.set(template.id, template);
    this.followers.set(template.id, templateFollowers);
  }

  saveBatch(items: Array<{ template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] }>): void {
    for (const item of items) {
      this.save(item.template, item.followers);
    }
  }

  findById(id: string): { template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] } | undefined {
    const template = this.templates.get(id);
    if (!template) return undefined;
    return { template, followers: this.followers.get(id) ?? [] };
  }

  findByPatternType(patternType: string): { template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] }[] {
    const results: { template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] }[] = [];
    for (const template of this.templates.values()) {
      if (template.patternTypes.includes(patternType)) {
        results.push({ template, followers: this.followers.get(template.id) ?? [] });
      }
    }
    return results;
  }

  findAll(): { template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] }[] {
    const results: { template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] }[] = [];
    for (const template of this.templates.values()) {
      results.push({ template, followers: this.followers.get(template.id) ?? [] });
    }
    return results;
  }

  clear(): void {
    this.templates.clear();
    this.followers.clear();
  }
}
