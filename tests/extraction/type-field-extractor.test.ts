import { describe, it, expect } from 'vitest';
import { extractTypeFields } from '@/extraction/type-field-extractor.js';

describe('extractTypeFields', () => {
  describe('basic fields', () => {
    it('should extract a simple string field', () => {
      const body = '  name: string;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('name');
      expect(fields[0].fieldType).toBe('string');
      expect(fields[0].isOptional).toBe(false);
      expect(fields[0].isReadonly).toBe(false);
      expect(fields[0].lineNumber).toBe(1);
    });

    it('should extract a number field', () => {
      const body = '  age: number;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('age');
      expect(fields[0].fieldType).toBe('number');
    });

    it('should extract a boolean field', () => {
      const body = '  active: boolean;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('active');
      expect(fields[0].fieldType).toBe('boolean');
    });
  });

  describe('optional fields', () => {
    it('should detect optional field with question mark', () => {
      const body = '  name?: string;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('name');
      expect(fields[0].fieldType).toBe('string');
      expect(fields[0].isOptional).toBe(true);
      expect(fields[0].isReadonly).toBe(false);
    });
  });

  describe('readonly fields', () => {
    it('should detect readonly field', () => {
      const body = '  readonly name: string;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('name');
      expect(fields[0].fieldType).toBe('string');
      expect(fields[0].isReadonly).toBe(true);
      expect(fields[0].isOptional).toBe(false);
    });

    it('should detect readonly optional field', () => {
      const body = '  readonly name?: string;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('name');
      expect(fields[0].fieldType).toBe('string');
      expect(fields[0].isReadonly).toBe(true);
      expect(fields[0].isOptional).toBe(true);
    });
  });

  describe('visibility modifiers', () => {
    it('should handle public modifier without readonly', () => {
      const body = '  public name: string;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('name');
      expect(fields[0].fieldType).toBe('string');
      expect(fields[0].isReadonly).toBe(false);
    });

    it('should handle private modifier without readonly', () => {
      const body = '  private count: number;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('count');
      expect(fields[0].fieldType).toBe('number');
      expect(fields[0].isReadonly).toBe(false);
    });

    it('should handle protected modifier without readonly', () => {
      const body = '  protected data: string;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('data');
      expect(fields[0].fieldType).toBe('string');
      expect(fields[0].isReadonly).toBe(false);
    });

    it('should handle private readonly modifier', () => {
      const body = '  private readonly id: string;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('id');
      expect(fields[0].fieldType).toBe('string');
      expect(fields[0].isReadonly).toBe(true);
    });

    it('should handle public readonly modifier', () => {
      const body = '  public readonly id: string;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('id');
      expect(fields[0].fieldType).toBe('string');
      expect(fields[0].isReadonly).toBe(true);
    });

    it('should handle protected readonly modifier', () => {
      const body = '  protected readonly config: object;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('config');
      expect(fields[0].fieldType).toBe('object');
      expect(fields[0].isReadonly).toBe(true);
    });
  });

  describe('complex types', () => {
    it('should extract array type', () => {
      const body = '  items: string[];';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('items');
      expect(fields[0].fieldType).toBe('string[]');
    });

    it('should extract generic type', () => {
      const body = '  cache: Map<string, number>;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('cache');
      expect(fields[0].fieldType).toBe('Map<string, number>');
    });

    it('should extract union type', () => {
      const body = '  value: string | null;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('value');
      expect(fields[0].fieldType).toBe('string | null');
    });

    it('should extract intersection type', () => {
      const body = '  data: Foo & Bar;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('data');
      expect(fields[0].fieldType).toBe('Foo & Bar');
    });
  });

  describe('line terminators', () => {
    it('should handle fields ending with semicolon', () => {
      const body = '  name: string;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].fieldType).toBe('string');
    });

    it('should handle fields ending with comma', () => {
      const body = '  name: string,';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].fieldType).toBe('string');
    });

    it('should handle fields ending with nothing', () => {
      const body = '  name: string';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(1);
      expect(fields[0].fieldType).toBe('string');
    });
  });

  describe('lines to skip', () => {
    it('should skip method signatures with parentheses before colon', () => {
      const body = '  getName(): string;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(0);
    });

    it('should skip method signatures with parameters', () => {
      const body = '  setName(name: string): void;';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(0);
    });

    it('should skip lines with only braces', () => {
      const body = '{\n}\n';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(0);
    });

    it('should skip single-line comments', () => {
      const body = '  // this is a comment';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(0);
    });

    it('should skip block comment lines', () => {
      const body = '  /* this is a block comment */';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(0);
    });

    it('should skip multi-line block comment lines', () => {
      const body = '  /** \n   * JSDoc comment\n   */';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(0);
    });

    it('should skip empty lines', () => {
      const body = '  \n\n  ';
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(0);
    });
  });

  describe('empty input', () => {
    it('should return empty array for empty string', () => {
      const fields = extractTypeFields('');
      expect(fields).toHaveLength(0);
    });
  });

  describe('multiple fields with line numbers', () => {
    it('should extract multiple fields with correct 1-based line numbers', () => {
      const body = [
        '  readonly id: string;',
        '  name: string;',
        '  age?: number;',
      ].join('\n');
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(3);

      expect(fields[0].name).toBe('id');
      expect(fields[0].lineNumber).toBe(1);
      expect(fields[0].isReadonly).toBe(true);

      expect(fields[1].name).toBe('name');
      expect(fields[1].lineNumber).toBe(2);
      expect(fields[1].isReadonly).toBe(false);

      expect(fields[2].name).toBe('age');
      expect(fields[2].lineNumber).toBe(3);
      expect(fields[2].isOptional).toBe(true);
    });

    it('should assign correct line numbers when skipping non-field lines', () => {
      const body = [
        '  // A comment line',
        '  readonly id: string;',
        '',
        '  name: string;',
        '  getName(): string;',
        '  age?: number;',
      ].join('\n');
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(3);

      expect(fields[0].name).toBe('id');
      expect(fields[0].lineNumber).toBe(2);

      expect(fields[1].name).toBe('name');
      expect(fields[1].lineNumber).toBe(4);

      expect(fields[2].name).toBe('age');
      expect(fields[2].lineNumber).toBe(6);
    });
  });

  describe('realistic interface body', () => {
    it('should extract fields from a typical interface body', () => {
      const body = [
        '  readonly id: string;',
        '  readonly name: string;',
        '  readonly unitType: CodeUnitType;',
        '  readonly lineStart: number;',
        '  readonly lineEnd: number;',
        '  readonly signature?: string;',
        '  readonly isAsync: boolean;',
        '  readonly isExported: boolean;',
        '  readonly children?: CodeUnitDeclaration[];',
        '  readonly body?: string;',
      ].join('\n');
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(10);

      expect(fields[0]).toEqual({
        name: 'id',
        fieldType: 'string',
        isOptional: false,
        isReadonly: true,
        lineNumber: 1,
      });

      expect(fields[5]).toEqual({
        name: 'signature',
        fieldType: 'string',
        isOptional: true,
        isReadonly: true,
        lineNumber: 6,
      });

      expect(fields[8]).toEqual({
        name: 'children',
        fieldType: 'CodeUnitDeclaration[]',
        isOptional: true,
        isReadonly: true,
        lineNumber: 9,
      });
    });

    it('should extract fields from a class body with mixed content', () => {
      const body = [
        '  private readonly db: Database;',
        '  public name: string;',
        '  protected count?: number;',
        '',
        '  constructor(db: Database) {',
        '    this.db = db;',
        '  }',
        '',
        '  getName(): string {',
        '    return this.name;',
        '  }',
      ].join('\n');
      const fields = extractTypeFields(body);
      expect(fields).toHaveLength(3);

      expect(fields[0]).toEqual({
        name: 'db',
        fieldType: 'Database',
        isOptional: false,
        isReadonly: true,
        lineNumber: 1,
      });

      expect(fields[1]).toEqual({
        name: 'name',
        fieldType: 'string',
        isOptional: false,
        isReadonly: false,
        lineNumber: 2,
      });

      expect(fields[2]).toEqual({
        name: 'count',
        fieldType: 'number',
        isOptional: true,
        isReadonly: false,
        lineNumber: 3,
      });
    });
  });
});
