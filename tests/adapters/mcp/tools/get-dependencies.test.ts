import { describe, it, expect, beforeEach } from 'vitest';
import { createGetDependenciesTool } from '@/adapters/mcp/tools/get-dependencies.js';
import { InMemoryFileDependencyRepository } from '../../../../tests/helpers/fakes/index.js';
import { createFileDependency, ImportType } from '@/domain/models/index.js';

describe('get-dependencies tool', () => {
  let dependencyRepo: InMemoryFileDependencyRepository;
  let handler: ReturnType<typeof createGetDependenciesTool>['handler'];

  beforeEach(() => {
    dependencyRepo = new InMemoryFileDependencyRepository();
    const tool = createGetDependenciesTool({ dependencyRepo });
    handler = tool.handler;

    dependencyRepo.save(createFileDependency({
      sourceFile: 'src/a.ts', targetFile: 'src/b.ts', importType: ImportType.NAMED, importedNames: ['fnB'],
    }));
    dependencyRepo.save(createFileDependency({
      sourceFile: 'src/b.ts', targetFile: 'src/c.ts', importType: ImportType.DEFAULT,
    }));
    dependencyRepo.save(createFileDependency({
      sourceFile: 'src/d.ts', targetFile: 'src/b.ts', importType: ImportType.NAMED, importedNames: ['fnB2'],
    }));
  });

  it('should return all dependencies', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(3);
    expect(parsed.meta.result_count).toBe(3);
  });

  it('should filter by source_file', async () => {
    const result = await handler({ source_file: 'src/a.ts' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].sourceFile).toBe('src/a.ts');
  });

  it('should filter by target_file', async () => {
    const result = await handler({ target_file: 'src/b.ts' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(2);
    expect(parsed.data.every((d: { targetFile: string }) => d.targetFile === 'src/b.ts')).toBe(true);
  });
});
