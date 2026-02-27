import { describe, it, expect } from 'vitest';
import { PatternType, CodeUnitType } from '@/domain/models/index.js';
import { JavaExtractor } from '@/extraction/languages/java.js';

describe('JavaExtractor', () => {
  const extractor = new JavaExtractor();

  it('should have correct languageId', () => {
    expect(extractor.languageId).toBe('java');
  });

  it('should have correct extensions', () => {
    expect(extractor.extensions).toEqual(['.java']);
  });

  describe('extractCodeUnits', () => {
    it('should extract class declarations', () => {
      const code = `public class UserService {
  private int count;
}`;
      const units = extractor.extractCodeUnits(code, 'UserService.java');
      const classes = units.filter(u => u.unitType === CodeUnitType.CLASS);
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('UserService');
      expect(classes[0].isExported).toBe(true);
    });

    it('should extract interface declarations', () => {
      const code = `public interface UserRepository {
  User findById(long id);
}`;
      const units = extractor.extractCodeUnits(code, 'UserRepository.java');
      const interfaces = units.filter(u => u.unitType === CodeUnitType.INTERFACE);
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].name).toBe('UserRepository');
      expect(interfaces[0].isExported).toBe(true);
    });

    it('should extract enum declarations', () => {
      const code = `public enum Status {
  ACTIVE,
  INACTIVE
}`;
      const units = extractor.extractCodeUnits(code, 'Status.java');
      const enums = units.filter(u => u.unitType === CodeUnitType.ENUM);
      expect(enums).toHaveLength(1);
      expect(enums[0].name).toBe('Status');
    });

    it('should extract methods as children of classes', () => {
      const code = `public class UserService {
  public User findUser(long id) {
    return repository.findById(id);
  }

  private void validateUser(User user) {
    if (user == null) throw new IllegalArgumentException();
  }
}`;
      const units = extractor.extractCodeUnits(code, 'UserService.java');
      const methods = units.filter(u => u.unitType === CodeUnitType.METHOD);
      expect(methods.length).toBeGreaterThanOrEqual(1);
      const findUser = methods.find(m => m.name === 'findUser');
      expect(findUser).toBeDefined();
      expect(findUser!.isExported).toBe(true);
    });

    it('should handle access modifiers correctly', () => {
      const code = `public class Service {
  private void doSomething() {
    return;
  }

  protected void doAnother() {
    return;
  }
}`;
      const units = extractor.extractCodeUnits(code, 'Service.java');
      const privateMethods = units.filter(
        u => u.unitType === CodeUnitType.METHOD && !u.isExported
      );
      expect(privateMethods.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract record declarations as CLASS', () => {
      const code = `public record UserDto(String name, String email) {
}`;
      const units = extractor.extractCodeUnits(code, 'UserDto.java');
      const classes = units.filter(u => u.unitType === CodeUnitType.CLASS);
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('UserDto');
    });
  });

  describe('extractDependencies', () => {
    it('should parse import statements', () => {
      const code = `import java.util.List;
import java.util.Map;
`;
      const deps = extractor.extractDependencies(code, 'Test.java');
      expect(deps).toHaveLength(2);
      expect(deps[0].targetFile).toBe('java.util.List');
      expect(deps[0].importedNames).toContain('List');
    });

    it('should parse wildcard imports', () => {
      const code = `import java.util.*;
`;
      const deps = extractor.extractDependencies(code, 'Test.java');
      expect(deps).toHaveLength(1);
      expect(deps[0].targetFile).toBe('java.util');
      expect(deps[0].importedNames).toContain('*');
    });

    it('should parse static imports', () => {
      const code = `import static java.lang.Math.PI;
`;
      const deps = extractor.extractDependencies(code, 'Test.java');
      expect(deps).toHaveLength(1);
      expect(deps[0].targetFile).toBe('java.lang.Math');
      expect(deps[0].importedNames).toContain('PI');
    });
  });

  describe('getPatternRules', () => {
    it('should detect Spring annotation endpoints', () => {
      const rules = extractor.getPatternRules();
      expect(rules.apiEndpoints.length).toBeGreaterThan(0);

      const code = '@GetMapping("/users")';
      const matched = rules.apiEndpoints.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });

    it('should detect JPA database operations', () => {
      const rules = extractor.getPatternRules();
      expect(rules.databaseReads.length).toBeGreaterThan(0);

      const code = 'entityManager.find(User.class, id)';
      const matched = rules.databaseReads.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });

    it('should detect env variable patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.envVariables.length).toBeGreaterThan(0);

      const code = 'System.getenv("DATABASE_URL")';
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

    it('should provide loop patterns', () => {
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
    expect(dirs).toContain('target');
    expect(dirs).toContain('.gradle');
  });

  it('should provide test file patterns', () => {
    const patterns = extractor.getTestFilePatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.test('UserServiceTest.java'))).toBe(true);
    expect(patterns.some(p => p.test('UserService.java'))).toBe(false);
  });
});
