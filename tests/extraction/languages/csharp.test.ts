import { describe, it, expect } from 'vitest';
import { PatternType, CodeUnitType } from '@/domain/models/index.js';
import { CSharpExtractor } from '@/extraction/languages/csharp.js';

describe('CSharpExtractor', () => {
  const extractor = new CSharpExtractor();

  it('should have correct languageId', () => {
    expect(extractor.languageId).toBe('csharp');
  });

  it('should have correct extensions', () => {
    expect(extractor.extensions).toEqual(['.cs']);
  });

  describe('extractCodeUnits', () => {
    it('should extract class declarations', () => {
      const code = `public class UserService {
    private readonly IUserRepository _repo;
}`;
      const units = extractor.extractCodeUnits(code, 'UserService.cs');
      const classes = units.filter(u => u.unitType === CodeUnitType.CLASS);
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('UserService');
      expect(classes[0].isExported).toBe(true);
    });

    it('should extract struct declarations', () => {
      const code = `public struct Point {
    public int X;
    public int Y;
}`;
      const units = extractor.extractCodeUnits(code, 'Point.cs');
      const structs = units.filter(u => u.unitType === CodeUnitType.STRUCT);
      expect(structs).toHaveLength(1);
      expect(structs[0].name).toBe('Point');
      expect(structs[0].isExported).toBe(true);
    });

    it('should extract interface declarations', () => {
      const code = `public interface IUserRepository {
    User FindById(int id);
}`;
      const units = extractor.extractCodeUnits(code, 'IUserRepository.cs');
      const interfaces = units.filter(u => u.unitType === CodeUnitType.INTERFACE);
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].name).toBe('IUserRepository');
      expect(interfaces[0].isExported).toBe(true);
    });

    it('should extract enum declarations', () => {
      const code = `public enum Status {
    Active,
    Inactive
}`;
      const units = extractor.extractCodeUnits(code, 'Status.cs');
      const enums = units.filter(u => u.unitType === CodeUnitType.ENUM);
      expect(enums).toHaveLength(1);
      expect(enums[0].name).toBe('Status');
    });

    it('should extract methods as children of classes', () => {
      const code = `public class UserService {
    public User FindUser(int id) {
        return _repo.FindById(id);
    }

    private void ValidateUser(User user) {
        if (user == null) throw new ArgumentException();
    }
}`;
      const units = extractor.extractCodeUnits(code, 'UserService.cs');
      const methods = units.filter(u => u.unitType === CodeUnitType.METHOD);
      expect(methods.length).toBeGreaterThanOrEqual(1);
      const findUser = methods.find(m => m.name === 'FindUser');
      expect(findUser).toBeDefined();
      expect(findUser!.isExported).toBe(true);
    });

    it('should handle access modifiers correctly', () => {
      const code = `public class Service {
    private void DoSomething() {
        return;
    }

    protected void DoAnother() {
        return;
    }
}`;
      const units = extractor.extractCodeUnits(code, 'Service.cs');
      const privateMethods = units.filter(
        u => u.unitType === CodeUnitType.METHOD && !u.isExported
      );
      expect(privateMethods.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect async methods', () => {
      const code = `public class Service {
    public async Task<User> GetUserAsync(int id) {
        return await _repo.FindByIdAsync(id);
    }
}`;
      const units = extractor.extractCodeUnits(code, 'Service.cs');
      const asyncMethods = units.filter(
        u => u.unitType === CodeUnitType.METHOD && u.isAsync
      );
      expect(asyncMethods.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract record declarations as CLASS', () => {
      const code = `public record UserDto(string Name, string Email) {
}`;
      const units = extractor.extractCodeUnits(code, 'UserDto.cs');
      const classes = units.filter(u => u.unitType === CodeUnitType.CLASS);
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('UserDto');
    });
  });

  describe('extractDependencies', () => {
    it('should parse using statements', () => {
      const code = `using System;
using System.Collections.Generic;
`;
      const deps = extractor.extractDependencies(code, 'Test.cs');
      expect(deps).toHaveLength(2);
      expect(deps[0].targetFile).toBe('System');
      expect(deps[1].targetFile).toBe('System.Collections.Generic');
    });

    it('should parse aliased using statements', () => {
      const code = `using Env = System.Environment;
`;
      const deps = extractor.extractDependencies(code, 'Test.cs');
      expect(deps).toHaveLength(1);
      expect(deps[0].targetFile).toBe('System.Environment');
      expect(deps[0].importedNames).toContain('Env');
    });

    it('should not parse resource disposal using statements', () => {
      const code = `using System;

public class Test {
    public void DoWork() {
        using (var stream = new FileStream("file.txt", FileMode.Open)) {
            stream.Read();
        }
    }
}`;
      const deps = extractor.extractDependencies(code, 'Test.cs');
      // Should only have the import using, not the resource disposal using
      expect(deps).toHaveLength(1);
      expect(deps[0].targetFile).toBe('System');
    });
  });

  describe('getPatternRules', () => {
    it('should detect ASP.NET attribute endpoints', () => {
      const rules = extractor.getPatternRules();
      expect(rules.apiEndpoints.length).toBeGreaterThan(0);

      const code = '[HttpGet("/users")]';
      const matched = rules.apiEndpoints.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });

    it('should detect Minimal API endpoints', () => {
      const rules = extractor.getPatternRules();

      const code = 'app.MapGet("/api/users", GetUsers)';
      const matched = rules.apiEndpoints.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });

    it('should detect Entity Framework operations', () => {
      const rules = extractor.getPatternRules();
      expect(rules.databaseWrites.length).toBeGreaterThan(0);

      const code = '.SaveChangesAsync()';
      const matched = rules.databaseWrites.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });

    it('should detect env variable patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.envVariables.length).toBeGreaterThan(0);

      const code = 'Environment.GetEnvironmentVariable("DATABASE_URL")';
      const matched = rules.envVariables.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });
  });

  describe('getComplexityPatterns', () => {
    it('should provide conditional patterns', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.conditionals.length).toBeGreaterThan(0);
    });

    it('should provide loop patterns including foreach', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.loops.length).toBeGreaterThan(0);
    });

    it('should provide error handling patterns', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.errorHandling.length).toBeGreaterThan(0);
    });

    it('should provide async patterns', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.asyncPatterns.length).toBeGreaterThan(0);
    });
  });

  it('should provide skip directories', () => {
    const dirs = extractor.getSkipDirectories();
    expect(dirs).toContain('bin');
    expect(dirs).toContain('obj');
    expect(dirs).toContain('.vs');
  });

  it('should provide test file patterns', () => {
    const patterns = extractor.getTestFilePatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.test('UserServiceTest.cs'))).toBe(true);
    expect(patterns.some(p => p.test('UserServiceTests.cs'))).toBe(true);
    expect(patterns.some(p => p.test('UserService.cs'))).toBe(false);
  });
});
