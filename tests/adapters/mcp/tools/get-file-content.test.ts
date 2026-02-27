import { describe, it, expect, beforeEach } from 'vitest';
import { createGetFileContentTool } from '@/adapters/mcp/tools/get-file-content.js';
import { InMemoryFileSystem } from '../../../../tests/helpers/fakes/index.js';

describe('get-file-content tool', () => {
  let fileSystem: InMemoryFileSystem;
  let handler: ReturnType<typeof createGetFileContentTool>['handler'];

  beforeEach(async () => {
    fileSystem = new InMemoryFileSystem();
    const tool = createGetFileContentTool({ fileSystem });
    handler = tool.handler;

    await fileSystem.writeFile('src/example.ts', 'line 1\nline 2\nline 3\nline 4\nline 5');
  });

  it('should read file content', async () => {
    const result = await handler({ file_path: 'src/example.ts' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.content).toBe('line 1\nline 2\nline 3\nline 4\nline 5');
    expect(parsed.data.file_path).toBe('src/example.ts');
  });

  it('should support line range', async () => {
    const result = await handler({ file_path: 'src/example.ts', line_start: 2, line_end: 4 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.content).toBe('line 2\nline 3\nline 4');
  });

  it('should return error for non-existent file', async () => {
    const result = await handler({ file_path: 'src/missing.ts' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('missing.ts');
  });
});
