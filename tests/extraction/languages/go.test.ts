import { describe, it, expect } from 'vitest';
import { PatternType, CodeUnitType } from '@/domain/models/index.js';
import { GoExtractor } from '@/extraction/languages/go.js';

describe('GoExtractor', () => {
  const extractor = new GoExtractor();

  it('should have correct languageId', () => {
    expect(extractor.languageId).toBe('go');
  });

  it('should have correct extensions', () => {
    expect(extractor.extensions).toEqual(['.go']);
  });

  describe('extractCodeUnits', () => {
    it('should extract function declarations', () => {
      const code = `package main

func handleRequest(w http.ResponseWriter, r *http.Request) {
  fmt.Fprintf(w, "Hello")
}`;
      const units = extractor.extractCodeUnits(code, 'main.go');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('handleRequest');
      expect(units[0].unitType).toBe(CodeUnitType.FUNCTION);
      expect(units[0].isExported).toBe(false);
      expect(units[0].isAsync).toBe(false);
      expect(units[0].signature).toContain('w http.ResponseWriter, r *http.Request');
    });

    it('should detect exported functions (uppercase first letter)', () => {
      const code = `package main

func HandleRequest(w http.ResponseWriter) {
  fmt.Fprintf(w, "Hello")
}`;
      const units = extractor.extractCodeUnits(code, 'main.go');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('HandleRequest');
      expect(units[0].isExported).toBe(true);
    });

    it('should extract methods with receivers', () => {
      const code = `package main

func (s *Server) Start(port int) error {
  return s.listen(port)
}`;
      const units = extractor.extractCodeUnits(code, 'server.go');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('Start');
      expect(units[0].unitType).toBe(CodeUnitType.METHOD);
      expect(units[0].isExported).toBe(true);
    });

    it('should extract struct declarations', () => {
      const code = `package main

type Server struct {
  host string
  port int
}`;
      const units = extractor.extractCodeUnits(code, 'server.go');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('Server');
      expect(units[0].unitType).toBe(CodeUnitType.STRUCT);
      expect(units[0].isExported).toBe(true);
    });

    it('should extract interface declarations', () => {
      const code = `package main

type Handler interface {
  ServeHTTP(w ResponseWriter, r *Request)
}`;
      const units = extractor.extractCodeUnits(code, 'handler.go');
      expect(units).toHaveLength(1);
      expect(units[0].name).toBe('Handler');
      expect(units[0].unitType).toBe(CodeUnitType.INTERFACE);
      expect(units[0].isExported).toBe(true);
    });

    it('should extract multiple code units and sort by line number', () => {
      const code = `package main

type Config struct {
  Port int
}

func NewConfig() *Config {
  return &Config{Port: 8080}
}

func (c *Config) Validate() error {
  return nil
}`;
      const units = extractor.extractCodeUnits(code, 'config.go');
      expect(units).toHaveLength(3);
      expect(units[0].unitType).toBe(CodeUnitType.STRUCT);
      expect(units[1].unitType).toBe(CodeUnitType.FUNCTION);
      expect(units[2].unitType).toBe(CodeUnitType.METHOD);
    });

    it('should not extract reserved keywords as function names', () => {
      const code = `package main

func if() {
}`;
      const units = extractor.extractCodeUnits(code, 'test.go');
      // 'if' is a reserved keyword and should be skipped
      const ifUnits = units.filter(u => u.name === 'if');
      expect(ifUnits).toHaveLength(0);
    });
  });

  describe('extractDependencies', () => {
    it('should parse single imports', () => {
      const code = `package main

import "fmt"
`;
      const deps = extractor.extractDependencies(code, 'main.go');
      expect(deps).toHaveLength(1);
      expect(deps[0].targetFile).toBe('fmt');
    });

    it('should parse grouped imports', () => {
      const code = `package main

import (
  "fmt"
  "net/http"
  "os"
)
`;
      const deps = extractor.extractDependencies(code, 'main.go');
      expect(deps).toHaveLength(3);
      expect(deps.map(d => d.targetFile)).toContain('fmt');
      expect(deps.map(d => d.targetFile)).toContain('net/http');
      expect(deps.map(d => d.targetFile)).toContain('os');
    });

    it('should parse aliased imports', () => {
      const code = `package main

import myhttp "net/http"
`;
      const deps = extractor.extractDependencies(code, 'main.go');
      expect(deps).toHaveLength(1);
      expect(deps[0].targetFile).toBe('net/http');
      expect(deps[0].importedNames).toContain('myhttp');
    });
  });

  describe('getPatternRules', () => {
    it('should detect Gin endpoint patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.apiEndpoints.length).toBeGreaterThan(0);

      const code = 'r.GET("/users", getUsers)';
      const matched = rules.apiEndpoints.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });

    it('should detect database/sql operations', () => {
      const rules = extractor.getPatternRules();
      expect(rules.databaseReads.length).toBeGreaterThan(0);

      const code = 'db.Query("SELECT * FROM users")';
      const matched = rules.databaseReads.some(rule => {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        return regex.test(code);
      });
      expect(matched).toBe(true);
    });

    it('should detect env variable patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.envVariables.length).toBeGreaterThan(0);

      const code = 'os.Getenv("DATABASE_URL")';
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

    it('should provide async patterns for goroutines', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.asyncPatterns.length).toBeGreaterThan(0);
    });
  });

  it('should provide skip directories including vendor', () => {
    const dirs = extractor.getSkipDirectories();
    expect(dirs).toContain('vendor');
  });

  it('should provide test file patterns', () => {
    const patterns = extractor.getTestFilePatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.test('handler_test.go'))).toBe(true);
    expect(patterns.some(p => p.test('handler.go'))).toBe(false);
  });
});
