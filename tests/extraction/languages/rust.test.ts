import { describe, it, expect } from 'vitest';
import { PatternType, CodeUnitType } from '@/domain/models/index.js';
import { RustExtractor } from '@/extraction/languages/rust.js';

describe('RustExtractor', () => {
  const extractor = new RustExtractor();

  it('should have correct languageId', () => {
    expect(extractor.languageId).toBe('rust');
  });

  it('should have correct extensions', () => {
    expect(extractor.extensions).toEqual(['.rs']);
  });

  describe('extractCodeUnits', () => {
    it('should extract pub functions', () => {
      const code = `pub fn create_user(name: &str) -> User {
    User::new(name)
}`;
      const units = extractor.extractCodeUnits(code, 'lib.rs');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('create_user');
      expect(units[0].unitType).toBe(CodeUnitType.FUNCTION);
      expect(units[0].isExported).toBe(true);
      expect(units[0].isAsync).toBe(false);
    });

    it('should extract async functions', () => {
      const code = `pub async fn fetch_data(url: &str) -> Result<Data, Error> {
    let resp = reqwest::get(url).await?;
    Ok(resp.json().await?)
}`;
      const units = extractor.extractCodeUnits(code, 'lib.rs');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('fetch_data');
      expect(units[0].isAsync).toBe(true);
      expect(units[0].isExported).toBe(true);
    });

    it('should extract private functions', () => {
      const code = `fn helper() -> bool {
    true
}`;
      const units = extractor.extractCodeUnits(code, 'lib.rs');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('helper');
      expect(units[0].isExported).toBe(false);
    });

    it('should extract struct declarations', () => {
      const code = `pub struct Config {
    pub host: String,
    pub port: u16,
}`;
      const units = extractor.extractCodeUnits(code, 'config.rs');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('Config');
      expect(units[0].unitType).toBe(CodeUnitType.STRUCT);
      expect(units[0].isExported).toBe(true);
    });

    it('should extract enum declarations', () => {
      const code = `pub enum Status {
    Active,
    Inactive,
    Pending,
}`;
      const units = extractor.extractCodeUnits(code, 'status.rs');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('Status');
      expect(units[0].unitType).toBe(CodeUnitType.ENUM);
      expect(units[0].isExported).toBe(true);
    });

    it('should extract trait declarations as INTERFACE', () => {
      const code = `pub trait Repository {
    fn find_by_id(&self, id: u64) -> Option<Entity>;
}`;
      const units = extractor.extractCodeUnits(code, 'traits.rs');
      const traits = units.filter(u => u.unitType === CodeUnitType.INTERFACE);
      expect(traits).toHaveLength(1);
      expect(traits[0].name).toBe('Repository');
      expect(traits[0].isExported).toBe(true);
    });

    it('should extract impl blocks', () => {
      const code = `impl Config {
    pub fn new() -> Self {
        Config { host: "localhost".into(), port: 8080 }
    }
}`;
      const units = extractor.extractCodeUnits(code, 'config.rs');
      const implBlocks = units.filter(u => u.unitType === CodeUnitType.IMPL_BLOCK);
      expect(implBlocks).toHaveLength(1);
      expect(implBlocks[0].name).toBe('impl Config');
    });

    it('should extract methods inside impl blocks', () => {
      const code = `impl Config {
    pub fn new() -> Self {
        Config { host: "localhost".into(), port: 8080 }
    }

    pub fn validate(&self) -> bool {
        self.port > 0
    }
}`;
      const units = extractor.extractCodeUnits(code, 'config.rs');
      const methods = units.filter(u => u.unitType === CodeUnitType.METHOD);
      expect(methods.length).toBeGreaterThanOrEqual(1);
      const newMethod = methods.find(m => m.name === 'new');
      expect(newMethod).toBeDefined();
    });

    it('should extract impl Trait for Type blocks', () => {
      const code = `impl Display for Config {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        write!(f, "{}:{}", self.host, self.port)
    }
}`;
      const units = extractor.extractCodeUnits(code, 'config.rs');
      const implBlocks = units.filter(u => u.unitType === CodeUnitType.IMPL_BLOCK);
      expect(implBlocks).toHaveLength(1);
      expect(implBlocks[0].name).toBe('impl Display for Config');
    });
  });

  describe('extractDependencies', () => {
    it('should parse use statements', () => {
      const code = `use std::collections::HashMap;
use std::io::Read;
`;
      const deps = extractor.extractDependencies(code, 'lib.rs');
      expect(deps).toHaveLength(2);
      expect(deps[0].targetFile).toBe('std::collections');
      expect(deps[0].importedNames).toContain('HashMap');
    });

    it('should parse grouped use statements', () => {
      const code = `use std::io::{Read, Write};
`;
      const deps = extractor.extractDependencies(code, 'lib.rs');
      expect(deps).toHaveLength(1);
      expect(deps[0].targetFile).toBe('std::io');
      expect(deps[0].importedNames).toContain('Read');
      expect(deps[0].importedNames).toContain('Write');
    });

    it('should parse wildcard use statements', () => {
      const code = `use std::prelude::*;
`;
      const deps = extractor.extractDependencies(code, 'lib.rs');
      expect(deps).toHaveLength(1);
      expect(deps[0].importedNames).toContain('*');
    });

    it('should parse mod declarations', () => {
      const code = `mod config;
mod handlers;
`;
      const deps = extractor.extractDependencies(code, 'main.rs');
      expect(deps).toHaveLength(2);
      expect(deps[0].targetFile).toBe('config');
      expect(deps[1].targetFile).toBe('handlers');
    });

    it('should parse extern crate declarations', () => {
      const code = `extern crate serde;
`;
      const deps = extractor.extractDependencies(code, 'lib.rs');
      expect(deps).toHaveLength(1);
      expect(deps[0].targetFile).toBe('serde');
      expect(deps[0].importedNames).toContain('serde');
    });
  });

  describe('getPatternRules', () => {
    it('should detect Actix endpoint patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.apiEndpoints.length).toBeGreaterThan(0);

      const code = '#[get("/users")]';
      const matched = rules.apiEndpoints.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });

    it('should detect Axum route patterns', () => {
      const rules = extractor.getPatternRules();

      const code = '.route("/api/users", get(list_users))';
      const matched = rules.apiEndpoints.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });

    it('should detect SQLx database operations', () => {
      const rules = extractor.getPatternRules();
      expect(rules.databaseReads.length).toBeGreaterThan(0);

      const code = 'sqlx::query("SELECT * FROM users")';
      const matched = rules.databaseReads.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });

    it('should detect env variable patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.envVariables.length).toBeGreaterThan(0);

      const code = 'std::env::var("DATABASE_URL")';
      const matched = rules.envVariables.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });
  });

  describe('getComplexityPatterns', () => {
    it('should provide conditional patterns including match', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.conditionals.length).toBeGreaterThan(0);
    });

    it('should provide loop patterns including loop keyword', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.loops.length).toBeGreaterThan(0);
    });

    it('should provide error handling patterns including ? operator', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.errorHandling.length).toBeGreaterThan(0);
    });

    it('should provide async patterns', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.asyncPatterns.length).toBeGreaterThan(0);
    });
  });

  it('should provide skip directories including target', () => {
    const dirs = extractor.getSkipDirectories();
    expect(dirs).toContain('target');
  });

  it('should provide test file patterns', () => {
    const patterns = extractor.getTestFilePatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.test('tests/integration.rs'))).toBe(true);
    expect(patterns.some(p => p.test('handler_test.rs'))).toBe(true);
    expect(patterns.some(p => p.test('handler.rs'))).toBe(false);
  });
});
