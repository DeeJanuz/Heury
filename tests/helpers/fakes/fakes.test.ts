import { describe, it, expect, beforeEach } from 'vitest';
import {
  CodeUnitType,
  createCodeUnit,
  ImportType,
  createFileDependency,
  createEnvVariable,
  createAnalysisResult,
  createAnalysisStats,
} from '@/domain/models/index.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryFileDependencyRepository,
  InMemoryEnvVariableRepository,
  InMemoryAnalysisRepository,
  FakeEmbeddingProvider,
  FakeVectorSearchService,
  InMemoryFileSystem,
  FakeConfigProvider,
} from './index.js';

function makeCodeUnit(overrides: Partial<Parameters<typeof createCodeUnit>[0]> = {}) {
  return createCodeUnit({
    filePath: 'src/index.ts',
    name: 'main',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 10,
    isAsync: false,
    isExported: true,
    language: 'typescript',
    ...overrides,
  });
}

function makeFileDependency(overrides: Partial<Parameters<typeof createFileDependency>[0]> = {}) {
  return createFileDependency({
    sourceFile: 'src/a.ts',
    targetFile: 'src/b.ts',
    importType: ImportType.NAMED,
    ...overrides,
  });
}

function makeEnvVariable(overrides: Partial<Parameters<typeof createEnvVariable>[0]> = {}) {
  return createEnvVariable({
    name: 'DATABASE_URL',
    lineNumber: 1,
    ...overrides,
  });
}

describe('InMemoryCodeUnitRepository', () => {
  let repo: InMemoryCodeUnitRepository;

  beforeEach(() => {
    repo = new InMemoryCodeUnitRepository();
  });

  it('should save and find a code unit by id', () => {
    const unit = makeCodeUnit({ id: 'unit-1' });
    repo.save(unit);
    expect(repo.findById('unit-1')).toEqual(unit);
  });

  it('should return undefined for non-existent id', () => {
    expect(repo.findById('non-existent')).toBeUndefined();
  });

  it('should save batch and find all', () => {
    const units = [
      makeCodeUnit({ id: 'u1', name: 'a' }),
      makeCodeUnit({ id: 'u2', name: 'b' }),
    ];
    repo.saveBatch(units);
    expect(repo.findAll()).toHaveLength(2);
  });

  it('should find by file path', () => {
    repo.save(makeCodeUnit({ filePath: 'src/a.ts', name: 'a' }));
    repo.save(makeCodeUnit({ filePath: 'src/b.ts', name: 'b' }));
    expect(repo.findByFilePath('src/a.ts')).toHaveLength(1);
  });

  it('should find by type', () => {
    repo.save(makeCodeUnit({ unitType: CodeUnitType.CLASS, name: 'MyClass' }));
    repo.save(makeCodeUnit({ unitType: CodeUnitType.FUNCTION, name: 'fn' }));
    expect(repo.findByType(CodeUnitType.CLASS)).toHaveLength(1);
  });

  it('should find by language', () => {
    repo.save(makeCodeUnit({ language: 'python', name: 'py_fn' }));
    repo.save(makeCodeUnit({ language: 'typescript', name: 'ts_fn' }));
    expect(repo.findByLanguage('python')).toHaveLength(1);
  });

  it('should delete by file path', () => {
    repo.save(makeCodeUnit({ filePath: 'src/a.ts', name: 'a' }));
    repo.save(makeCodeUnit({ filePath: 'src/b.ts', name: 'b' }));
    repo.deleteByFilePath('src/a.ts');
    expect(repo.findAll()).toHaveLength(1);
    expect(repo.findByFilePath('src/a.ts')).toHaveLength(0);
  });

  it('should clear all units', () => {
    repo.save(makeCodeUnit());
    repo.clear();
    expect(repo.findAll()).toHaveLength(0);
  });

  it('should overwrite existing unit on save with same id', () => {
    repo.save(makeCodeUnit({ id: 'u1', name: 'original' }));
    repo.save(makeCodeUnit({ id: 'u1', name: 'updated' }));
    expect(repo.findById('u1')?.name).toBe('updated');
    expect(repo.findAll()).toHaveLength(1);
  });
});

describe('InMemoryFileDependencyRepository', () => {
  let repo: InMemoryFileDependencyRepository;

  beforeEach(() => {
    repo = new InMemoryFileDependencyRepository();
  });

  it('should save and find by source file', () => {
    const dep = makeFileDependency({ sourceFile: 'src/a.ts' });
    repo.save(dep);
    expect(repo.findBySourceFile('src/a.ts')).toHaveLength(1);
  });

  it('should find by target file', () => {
    repo.save(makeFileDependency({ targetFile: 'src/b.ts' }));
    expect(repo.findByTargetFile('src/b.ts')).toHaveLength(1);
    expect(repo.findByTargetFile('src/c.ts')).toHaveLength(0);
  });

  it('should save batch and find all', () => {
    repo.saveBatch([
      makeFileDependency({ id: 'd1' }),
      makeFileDependency({ id: 'd2' }),
    ]);
    expect(repo.findAll()).toHaveLength(2);
  });

  it('should delete by source file', () => {
    repo.save(makeFileDependency({ id: 'd1', sourceFile: 'src/a.ts' }));
    repo.save(makeFileDependency({ id: 'd2', sourceFile: 'src/b.ts' }));
    repo.deleteBySourceFile('src/a.ts');
    expect(repo.findAll()).toHaveLength(1);
  });

  it('should clear all', () => {
    repo.save(makeFileDependency());
    repo.clear();
    expect(repo.findAll()).toHaveLength(0);
  });
});

describe('InMemoryEnvVariableRepository', () => {
  let repo: InMemoryEnvVariableRepository;

  beforeEach(() => {
    repo = new InMemoryEnvVariableRepository();
  });

  it('should save and find by name', () => {
    const envVar = makeEnvVariable({ name: 'API_KEY' });
    repo.save(envVar);
    expect(repo.findByName('API_KEY')).toEqual(envVar);
  });

  it('should return undefined for non-existent name', () => {
    expect(repo.findByName('MISSING')).toBeUndefined();
  });

  it('should save batch and find all', () => {
    repo.saveBatch([
      makeEnvVariable({ name: 'A', lineNumber: 1 }),
      makeEnvVariable({ name: 'B', lineNumber: 2 }),
    ]);
    expect(repo.findAll()).toHaveLength(2);
  });

  it('should clear all', () => {
    repo.save(makeEnvVariable());
    repo.clear();
    expect(repo.findAll()).toHaveLength(0);
  });
});

describe('InMemoryAnalysisRepository', () => {
  let repo: InMemoryAnalysisRepository;

  beforeEach(() => {
    repo = new InMemoryAnalysisRepository();
  });

  it('should save and retrieve latest result', () => {
    const result = createAnalysisResult({ success: true });
    repo.saveResult(result);
    expect(repo.getLatestResult()).toEqual(result);
  });

  it('should return undefined when no results saved', () => {
    expect(repo.getLatestResult()).toBeUndefined();
  });

  it('should return most recently saved result', () => {
    repo.saveResult(createAnalysisResult({ success: false, error: 'fail' }));
    repo.saveResult(createAnalysisResult({ success: true }));
    expect(repo.getLatestResult()?.success).toBe(true);
  });

  it('should clear results', () => {
    repo.saveResult(createAnalysisResult({ success: true }));
    repo.clear();
    expect(repo.getLatestResult()).toBeUndefined();
  });
});

describe('FakeEmbeddingProvider', () => {
  it('should return zero vector with correct dimensions', async () => {
    const provider = new FakeEmbeddingProvider(384);
    const embedding = await provider.generateEmbedding('hello');
    expect(embedding).toHaveLength(384);
    expect(embedding.every((v) => v === 0)).toBe(true);
  });

  it('should return correct dimensions via getDimensions', () => {
    const provider = new FakeEmbeddingProvider(128);
    expect(provider.getDimensions()).toBe(128);
  });

  it('should generate batch embeddings', async () => {
    const provider = new FakeEmbeddingProvider(64);
    const embeddings = await provider.generateEmbeddings(['a', 'b', 'c']);
    expect(embeddings).toHaveLength(3);
    expect(embeddings[0]).toHaveLength(64);
  });
});

describe('FakeVectorSearchService', () => {
  let service: FakeVectorSearchService;

  beforeEach(() => {
    service = new FakeVectorSearchService();
  });

  it('should index and search returning results sorted by score descending', async () => {
    await service.index('a', [1, 0, 0], { label: 'a' });
    await service.index('b', [0, 1, 0], { label: 'b' });
    await service.index('c', [0.9, 0.1, 0], { label: 'c' });

    const results = await service.search([1, 0, 0], 3);
    expect(results).toHaveLength(3);
    expect(results[0].id).toBe('a');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('should respect limit parameter', async () => {
    await service.index('a', [1, 0], {});
    await service.index('b', [0, 1], {});
    const results = await service.search([1, 0], 1);
    expect(results).toHaveLength(1);
  });

  it('should delete indexed vectors', async () => {
    await service.index('a', [1, 0], {});
    await service.delete('a');
    const results = await service.search([1, 0], 10);
    expect(results).toHaveLength(0);
  });

  it('should clear all vectors', async () => {
    await service.index('a', [1, 0], {});
    await service.index('b', [0, 1], {});
    await service.clear();
    const results = await service.search([1, 0], 10);
    expect(results).toHaveLength(0);
  });
});

describe('InMemoryFileSystem', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
  });

  it('should write and read files', async () => {
    await fs.writeFile('/src/index.ts', 'console.log("hello")');
    const content = await fs.readFile('/src/index.ts');
    expect(content).toBe('console.log("hello")');
  });

  it('should report existence correctly', async () => {
    await fs.writeFile('/a.txt', 'content');
    expect(await fs.exists('/a.txt')).toBe(true);
    expect(await fs.exists('/b.txt')).toBe(false);
  });

  it('should throw when reading non-existent file', async () => {
    await expect(fs.readFile('/missing.txt')).rejects.toThrow();
  });

  it('should compute a deterministic file hash', async () => {
    await fs.writeFile('/a.txt', 'content');
    const hash1 = await fs.getFileHash('/a.txt');
    const hash2 = await fs.getFileHash('/a.txt');
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBeGreaterThan(0);
  });

  it('should list files matching a pattern', async () => {
    await fs.writeFile('/src/a.ts', '');
    await fs.writeFile('/src/b.ts', '');
    await fs.writeFile('/src/c.js', '');
    const tsFiles = await fs.listFiles('/src', '*.ts');
    expect(tsFiles).toHaveLength(2);
  });

  it('should report directories correctly', async () => {
    await fs.mkdir('/src');
    expect(await fs.isDirectory('/src')).toBe(true);
    expect(await fs.isDirectory('/missing')).toBe(false);
  });
});

describe('FakeConfigProvider', () => {
  it('should return default config', () => {
    const provider = new FakeConfigProvider();
    const config = provider.getDefault();
    expect(config.rootDir).toBeDefined();
    expect(config.outputDir).toBeDefined();
    expect(config.include).toBeDefined();
    expect(config.exclude).toBeDefined();
    expect(config.embedding).toBeDefined();
  });

  it('should load saved config', async () => {
    const provider = new FakeConfigProvider();
    const config = provider.getDefault();
    config.rootDir = '/custom';
    await provider.save(config);
    const loaded = await provider.load();
    expect(loaded.rootDir).toBe('/custom');
  });

  it('should load default when nothing saved', async () => {
    const provider = new FakeConfigProvider();
    const loaded = await provider.load();
    expect(loaded).toEqual(provider.getDefault());
  });
});
