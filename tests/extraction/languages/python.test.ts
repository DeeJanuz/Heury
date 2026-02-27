import { describe, it, expect } from 'vitest';
import { CodeUnitType, PatternType } from '@/domain/models/index.js';
import { PythonExtractor } from '@/extraction/languages/python.js';

describe('PythonExtractor', () => {
  const extractor = new PythonExtractor();

  it('should have correct languageId', () => {
    expect(extractor.languageId).toBe('python');
  });

  it('should have correct extensions', () => {
    expect(extractor.extensions).toContain('.py');
    expect(extractor.extensions).toContain('.pyw');
  });

  describe('extractCodeUnits', () => {
    it('should extract function declarations', () => {
      const code = `def hello():\n    return "world"\n`;
      const units = extractor.extractCodeUnits(code, 'app.py');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('hello');
      expect(units[0].unitType).toBe(CodeUnitType.FUNCTION);
      expect(units[0].lineStart).toBe(1);
      expect(units[0].isAsync).toBe(false);
      expect(units[0].isExported).toBe(true);
    });

    it('should extract async functions', () => {
      const code = `async def fetch_data():\n    await get_stuff()\n    return data\n`;
      const units = extractor.extractCodeUnits(code, 'app.py');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('fetch_data');
      expect(units[0].unitType).toBe(CodeUnitType.FUNCTION);
      expect(units[0].isAsync).toBe(true);
    });

    it('should extract classes with methods', () => {
      const code = [
        'class UserService:',
        '    def __init__(self, db):',
        '        self.db = db',
        '',
        '    def get_user(self, user_id):',
        '        return self.db.find(user_id)',
        '',
        '    async def update_user(self, user_id, data):',
        '        return await self.db.update(user_id, data)',
        '',
      ].join('\n');
      const units = extractor.extractCodeUnits(code, 'service.py');

      const classUnit = units.find(u => u.name === 'UserService');
      expect(classUnit).toBeDefined();
      expect(classUnit!.unitType).toBe(CodeUnitType.CLASS);
      expect(classUnit!.isExported).toBe(true);

      const methods = units.filter(u => u.unitType === CodeUnitType.METHOD);
      expect(methods).toHaveLength(3);
      expect(methods.map(m => m.name)).toContain('__init__');
      expect(methods.map(m => m.name)).toContain('get_user');
      expect(methods.map(m => m.name)).toContain('update_user');
    });

    it('should detect methods as children of class', () => {
      const code = [
        'class MyClass:',
        '    def method_one(self):',
        '        pass',
        '',
        'def standalone():',
        '    pass',
        '',
      ].join('\n');
      const units = extractor.extractCodeUnits(code, 'test.py');

      const method = units.find(u => u.name === 'method_one');
      expect(method).toBeDefined();
      expect(method!.unitType).toBe(CodeUnitType.METHOD);

      const standalone = units.find(u => u.name === 'standalone');
      expect(standalone).toBeDefined();
      expect(standalone!.unitType).toBe(CodeUnitType.FUNCTION);
    });

    it('should strip self parameter from method signatures', () => {
      const code = [
        'class Foo:',
        '    def bar(self, x, y):',
        '        pass',
        '',
      ].join('\n');
      const units = extractor.extractCodeUnits(code, 'foo.py');

      const method = units.find(u => u.name === 'bar');
      expect(method).toBeDefined();
      expect(method!.signature).not.toContain('self');
      expect(method!.signature).toContain('x');
      expect(method!.signature).toContain('y');
    });

    it('should detect lambda assignments as ARROW_FUNCTION', () => {
      const code = `double = lambda x: x * 2\n`;
      const units = extractor.extractCodeUnits(code, 'utils.py');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('double');
      expect(units[0].unitType).toBe(CodeUnitType.ARROW_FUNCTION);
      expect(units[0].signature).toContain('x');
    });

    it('should use indentation-based block end detection', () => {
      const code = [
        'def outer():',
        '    x = 1',
        '    y = 2',
        '    return x + y',
        '',
        'def another():',
        '    pass',
        '',
      ].join('\n');
      const units = extractor.extractCodeUnits(code, 'test.py');

      const outer = units.find(u => u.name === 'outer');
      expect(outer).toBeDefined();
      expect(outer!.lineStart).toBe(1);
      expect(outer!.lineEnd).toBe(4);

      const another = units.find(u => u.name === 'another');
      expect(another).toBeDefined();
      expect(another!.lineStart).toBe(6);
    });

    it('should treat underscore-prefixed names as non-exported', () => {
      const code = [
        'def public_func():',
        '    pass',
        '',
        'def _private_func():',
        '    pass',
        '',
      ].join('\n');
      const units = extractor.extractCodeUnits(code, 'mod.py');

      const pub = units.find(u => u.name === 'public_func');
      expect(pub!.isExported).toBe(true);

      const priv = units.find(u => u.name === '_private_func');
      expect(priv!.isExported).toBe(false);
    });

    it('should respect __all__ for export detection', () => {
      const code = [
        '__all__ = ["exported_func"]',
        '',
        'def exported_func():',
        '    pass',
        '',
        'def not_exported():',
        '    pass',
        '',
      ].join('\n');
      const units = extractor.extractCodeUnits(code, 'mod.py');

      const exported = units.find(u => u.name === 'exported_func');
      expect(exported!.isExported).toBe(true);

      const notExported = units.find(u => u.name === 'not_exported');
      expect(notExported!.isExported).toBe(false);
    });

    it('should extract class with base classes in signature', () => {
      const code = [
        'class Dog(Animal, Serializable):',
        '    def bark(self):',
        '        pass',
        '',
      ].join('\n');
      const units = extractor.extractCodeUnits(code, 'animals.py');

      const cls = units.find(u => u.name === 'Dog');
      expect(cls).toBeDefined();
      expect(cls!.unitType).toBe(CodeUnitType.CLASS);
      expect(cls!.signature).toBe('(Animal, Serializable)');
    });
  });

  describe('extractDependencies', () => {
    it('should parse from X import Y statements', () => {
      const code = `from utils import helper, formatter\n`;
      const deps = extractor.extractDependencies(code, 'app.py');
      expect(deps).toHaveLength(1);
      expect(deps[0].targetFile).toBe('utils');
      expect(deps[0].importedNames).toEqual(['helper', 'formatter']);
    });

    it('should parse import X statements', () => {
      const code = `import requests\n`;
      const deps = extractor.extractDependencies(code, 'app.py');
      expect(deps).toHaveLength(1);
      expect(deps[0].targetFile).toBe('requests');
      expect(deps[0].importedNames).toEqual([]);
    });

    it('should parse relative imports', () => {
      const code = `from . import sibling\nfrom ..models import User\n`;
      const deps = extractor.extractDependencies(code, 'src/views/main.py');
      expect(deps).toHaveLength(2);

      const siblingDep = deps.find(d => d.importedNames.includes('sibling'));
      expect(siblingDep).toBeDefined();

      const userDep = deps.find(d => d.importedNames.includes('User'));
      expect(userDep).toBeDefined();
    });

    it('should parse wildcard imports', () => {
      const code = `from utils import *\n`;
      const deps = extractor.extractDependencies(code, 'app.py');
      expect(deps).toHaveLength(1);
      expect(deps[0].importType).toBe('NAMESPACE');
      expect(deps[0].importedNames).toEqual([]);
    });

    it('should handle import X as Y aliases', () => {
      const code = `import numpy as np\n`;
      const deps = extractor.extractDependencies(code, 'app.py');
      expect(deps).toHaveLength(1);
      expect(deps[0].targetFile).toBe('numpy');
    });
  });

  describe('getPatternRules', () => {
    it('should detect Flask routes', () => {
      const rules = extractor.getPatternRules();
      const endpointRules = rules.apiEndpoints;
      expect(endpointRules.length).toBeGreaterThan(0);

      const code = `@app.route('/users', methods=['GET', 'POST'])`;
      const flaskRule = endpointRules[0];
      const regex = new RegExp(flaskRule.pattern.source, flaskRule.pattern.flags);
      const match = regex.exec(code);
      expect(match).not.toBeNull();
      expect(flaskRule.patternType).toBe(PatternType.API_ENDPOINT);
    });

    it('should detect FastAPI decorators', () => {
      const rules = extractor.getPatternRules();
      const endpointRules = rules.apiEndpoints;

      const code = `@app.get('/users')`;
      let matched = false;
      for (const rule of endpointRules) {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        const match = regex.exec(code);
        if (match) {
          matched = true;
          expect(rule.patternType).toBe(PatternType.API_ENDPOINT);
          if (rule.extractValue) {
            const value = rule.extractValue(match);
            expect(value).toContain('GET');
            expect(value).toContain('/users');
          }
          break;
        }
      }
      expect(matched).toBe(true);
    });

    it('should detect Django ORM operations', () => {
      const rules = extractor.getPatternRules();
      const readRules = rules.databaseReads;

      const code = `User.objects.filter(active=True)`;
      let matched = false;
      for (const rule of readRules) {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        const match = regex.exec(code);
        if (match) {
          matched = true;
          expect(rule.patternType).toBe(PatternType.DATABASE_READ);
          break;
        }
      }
      expect(matched).toBe(true);
    });

    it('should detect os.environ access', () => {
      const rules = extractor.getPatternRules();
      const envRules = rules.envVariables;

      const testCases = [
        `os.environ['DATABASE_URL']`,
        `os.environ.get('SECRET_KEY')`,
        `os.getenv('API_KEY')`,
      ];

      for (const code of testCases) {
        let matched = false;
        for (const rule of envRules) {
          const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
          const match = regex.exec(code);
          if (match) {
            matched = true;
            expect(rule.patternType).toBe(PatternType.ENV_VARIABLE);
            break;
          }
        }
        expect(matched).toBe(true);
      }
    });

    it('should detect requests library API calls', () => {
      const rules = extractor.getPatternRules();
      const callRules = rules.apiCalls;

      const code = `requests.get('https://api.example.com/data')`;
      let matched = false;
      for (const rule of callRules) {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        const match = regex.exec(code);
        if (match) {
          matched = true;
          expect(rule.patternType).toBe(PatternType.API_CALL);
          break;
        }
      }
      expect(matched).toBe(true);
    });

    it('should detect boto3 AWS SDK calls', () => {
      const rules = extractor.getPatternRules();
      const serviceRules = rules.externalServices;

      const code = `boto3.client('s3')`;
      let matched = false;
      for (const rule of serviceRules) {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        const match = regex.exec(code);
        if (match) {
          matched = true;
          expect(rule.patternType).toBe(PatternType.EXTERNAL_SERVICE);
          break;
        }
      }
      expect(matched).toBe(true);
    });
  });

  describe('getSkipDirectories', () => {
    it('should include __pycache__ and venv directories', () => {
      const dirs = extractor.getSkipDirectories();
      expect(dirs).toContain('__pycache__');
      expect(dirs).toContain('venv');
      expect(dirs).toContain('.venv');
    });
  });

  describe('getTestFilePatterns', () => {
    it('should match test_*.py and *_test.py patterns', () => {
      const patterns = extractor.getTestFilePatterns();

      expect(patterns.some(p => p.test('test_utils.py'))).toBe(true);
      expect(patterns.some(p => p.test('utils_test.py'))).toBe(true);
      expect(patterns.some(p => p.test('regular.py'))).toBe(false);
    });
  });

  describe('getComplexityPatterns', () => {
    it('should include Python-specific patterns', () => {
      const patterns = extractor.getComplexityPatterns();

      expect(patterns.conditionals.length).toBeGreaterThan(0);
      expect(patterns.loops.length).toBeGreaterThan(0);
      expect(patterns.errorHandling.length).toBeGreaterThan(0);
      expect(patterns.asyncPatterns.length).toBeGreaterThan(0);
    });
  });
});
