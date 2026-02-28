import { describe, it, expect } from 'vitest';
import { createTypeField } from '@/domain/models/type-field.js';

describe('createTypeField', () => {
  it('should create a type field with all required fields', () => {
    const field = createTypeField({
      parentUnitId: 'parent-1',
      name: 'username',
      fieldType: 'string',
      isOptional: false,
      isReadonly: true,
      lineNumber: 5,
    });

    expect(field.parentUnitId).toBe('parent-1');
    expect(field.name).toBe('username');
    expect(field.fieldType).toBe('string');
    expect(field.isOptional).toBe(false);
    expect(field.isReadonly).toBe(true);
    expect(field.lineNumber).toBe(5);
    expect(field.id).toBeDefined();
  });

  it('should use provided id when given', () => {
    const field = createTypeField({
      id: 'custom-id',
      parentUnitId: 'parent-1',
      name: 'age',
      fieldType: 'number',
      isOptional: true,
      isReadonly: false,
      lineNumber: 10,
    });

    expect(field.id).toBe('custom-id');
  });

  it('should throw when parentUnitId is empty', () => {
    expect(() =>
      createTypeField({
        parentUnitId: '',
        name: 'username',
        fieldType: 'string',
        isOptional: false,
        isReadonly: false,
        lineNumber: 1,
      }),
    ).toThrow('parentUnitId must not be empty');
  });

  it('should throw when name is empty', () => {
    expect(() =>
      createTypeField({
        parentUnitId: 'parent-1',
        name: '',
        fieldType: 'string',
        isOptional: false,
        isReadonly: false,
        lineNumber: 1,
      }),
    ).toThrow('name must not be empty');
  });

  it('should throw when fieldType is empty', () => {
    expect(() =>
      createTypeField({
        parentUnitId: 'parent-1',
        name: 'username',
        fieldType: '',
        isOptional: false,
        isReadonly: false,
        lineNumber: 1,
      }),
    ).toThrow('fieldType must not be empty');
  });

  it('should throw when lineNumber is less than 1', () => {
    expect(() =>
      createTypeField({
        parentUnitId: 'parent-1',
        name: 'username',
        fieldType: 'string',
        isOptional: false,
        isReadonly: false,
        lineNumber: 0,
      }),
    ).toThrow('lineNumber must be >= 1');
  });
});
