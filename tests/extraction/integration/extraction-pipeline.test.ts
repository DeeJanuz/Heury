import { describe, it, expect } from 'vitest';
import { createLanguageRegistry } from '@/extraction/languages/index.js';

describe('Registry Wiring + Integration', () => {
  describe('createLanguageRegistry', () => {
    it('should return a registry with all 6 languages registered', () => {
      const registry = createLanguageRegistry();
      const languages = registry.getRegisteredLanguages();

      expect(languages).toHaveLength(6);
      expect(languages).toContain('javascript-typescript');
      expect(languages).toContain('python');
      expect(languages).toContain('go');
      expect(languages).toContain('java');
      expect(languages).toContain('rust');
      expect(languages).toContain('csharp');
    });

    it('should support all expected file extensions', () => {
      const registry = createLanguageRegistry();
      const extensions = registry.getSupportedExtensions();

      // JS/TS
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
      expect(extensions).toContain('.jsx');
      expect(extensions).toContain('.mjs');
      expect(extensions).toContain('.cjs');

      // Python
      expect(extensions).toContain('.py');
      expect(extensions).toContain('.pyw');

      // Go
      expect(extensions).toContain('.go');

      // Java
      expect(extensions).toContain('.java');

      // Rust
      expect(extensions).toContain('.rs');

      // C#
      expect(extensions).toContain('.cs');
    });

    it('should return undefined for unknown extensions', () => {
      const registry = createLanguageRegistry();

      expect(registry.getExtractorForFile('file.rb')).toBeUndefined();
      expect(registry.getExtractorForFile('file.php')).toBeUndefined();
      expect(registry.getExtractorForFile('file.swift')).toBeUndefined();
      expect(registry.getExtractorForFile('noextension')).toBeUndefined();
    });
  });

  describe('JavaScript/TypeScript integration', () => {
    it('should extract code units and dependencies from JS/TS code', () => {
      const registry = createLanguageRegistry();
      const extractor = registry.getExtractorForFile('src/routes/users.ts');

      expect(extractor).toBeDefined();
      expect(extractor!.languageId).toBe('javascript-typescript');

      const code = `
import { Router } from 'express';
import { prisma } from './db';

const router = Router();

export async function getUsers(req, res) {
  const users = await prisma.user.findMany();
  res.json(users);
}

router.get('/api/users', getUsers);
`;

      const units = extractor!.extractCodeUnits(code, 'src/routes/users.ts');
      const getUsers = units.find(u => u.name === 'getUsers');
      expect(getUsers).toBeDefined();
      expect(getUsers!.unitType).toBe('FUNCTION');
      expect(getUsers!.isAsync).toBe(true);
      expect(getUsers!.isExported).toBe(true);

      const patternRules = extractor!.getPatternRules();
      expect(patternRules.apiEndpoints.length).toBeGreaterThan(0);
      expect(patternRules.databaseReads.length).toBeGreaterThan(0);
    });
  });

  describe('Python integration', () => {
    it('should extract functions, classes, and methods from Python code', () => {
      const registry = createLanguageRegistry();
      const extractor = registry.getExtractorForFile('app/views.py');

      expect(extractor).toBeDefined();
      expect(extractor!.languageId).toBe('python');

      const code = `from flask import Flask
from .models import User

app = Flask(__name__)

@app.route('/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify(users)

class UserService:
    def create_user(self, data):
        user = User(**data)
        db.session.add(user)
        return user
`;

      const units = extractor!.extractCodeUnits(code, 'app/views.py');

      const getUsers = units.find(u => u.name === 'get_users');
      expect(getUsers).toBeDefined();
      expect(getUsers!.unitType).toBe('FUNCTION');

      const userService = units.find(u => u.name === 'UserService');
      expect(userService).toBeDefined();
      expect(userService!.unitType).toBe('CLASS');

      const createUser = units.find(u => u.name === 'create_user');
      expect(createUser).toBeDefined();
      expect(createUser!.unitType).toBe('METHOD');

      const deps = extractor!.extractDependencies(code, 'app/views.py');
      expect(deps.length).toBeGreaterThan(0);

      const flaskDep = deps.find(d => d.targetFile === 'flask');
      expect(flaskDep).toBeDefined();

      const patternRules = extractor!.getPatternRules();
      expect(patternRules.apiEndpoints.length).toBeGreaterThan(0);
      expect(patternRules.databaseReads.length).toBeGreaterThan(0);
    });
  });

  describe('Go integration', () => {
    it('should extract functions, structs, and methods from Go code', () => {
      const registry = createLanguageRegistry();
      const extractor = registry.getExtractorForFile('main.go');

      expect(extractor).toBeDefined();
      expect(extractor!.languageId).toBe('go');

      const code = `package main

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

func GetUsers(c *gin.Context) {
    users := db.Query("SELECT * FROM users")
    c.JSON(http.StatusOK, users)
}

type UserService struct {
    db *sql.DB
}

func (s *UserService) CreateUser(name string) error {
    _, err := s.db.Exec("INSERT INTO users (name) VALUES (?)", name)
    return err
}
`;

      const units = extractor!.extractCodeUnits(code, 'main.go');

      const getUsers = units.find(u => u.name === 'GetUsers');
      expect(getUsers).toBeDefined();
      expect(getUsers!.unitType).toBe('FUNCTION');
      expect(getUsers!.isExported).toBe(true);

      const userService = units.find(u => u.name === 'UserService');
      expect(userService).toBeDefined();
      expect(userService!.unitType).toBe('STRUCT');

      const createUser = units.find(u => u.name === 'CreateUser');
      expect(createUser).toBeDefined();
      expect(createUser!.unitType).toBe('METHOD');

      const deps = extractor!.extractDependencies(code, 'main.go');
      expect(deps.length).toBeGreaterThan(0);

      const httpDep = deps.find(d => d.targetFile === 'net/http');
      expect(httpDep).toBeDefined();

      const ginDep = deps.find(d => d.targetFile === 'github.com/gin-gonic/gin');
      expect(ginDep).toBeDefined();

      const patternRules = extractor!.getPatternRules();
      expect(patternRules.apiEndpoints.length).toBeGreaterThan(0);
      expect(patternRules.databaseReads.length).toBeGreaterThan(0);
    });
  });

  describe('Java integration', () => {
    it('should extract classes and methods from Java code', () => {
      const registry = createLanguageRegistry();
      const extractor = registry.getExtractorForFile('UserController.java');

      expect(extractor).toBeDefined();
      expect(extractor!.languageId).toBe('java');

      const code = `import org.springframework.web.bind.annotation.*;
import com.example.model.User;

@RestController
public class UserController {
    @GetMapping("/api/users")
    public List<User> getUsers() {
        return userRepository.findAll();
    }

    @PostMapping("/api/users")
    public User createUser(@RequestBody User user) {
        return userRepository.save(user);
    }
}
`;

      const units = extractor!.extractCodeUnits(code, 'UserController.java');

      const controller = units.find(u => u.name === 'UserController');
      expect(controller).toBeDefined();
      expect(controller!.unitType).toBe('CLASS');

      const getUsers = units.find(u => u.name === 'getUsers');
      expect(getUsers).toBeDefined();
      expect(getUsers!.unitType).toBe('METHOD');

      const createUser = units.find(u => u.name === 'createUser');
      expect(createUser).toBeDefined();
      expect(createUser!.unitType).toBe('METHOD');

      const deps = extractor!.extractDependencies(code, 'UserController.java');
      expect(deps.length).toBeGreaterThan(0);

      const springDep = deps.find(d =>
        d.targetFile.includes('springframework')
      );
      expect(springDep).toBeDefined();

      const patternRules = extractor!.getPatternRules();
      expect(patternRules.apiEndpoints.length).toBeGreaterThan(0);
      expect(patternRules.databaseReads.length).toBeGreaterThan(0);
    });
  });

  describe('Rust integration', () => {
    it('should extract functions, structs, and impl blocks from Rust code', () => {
      const registry = createLanguageRegistry();
      const extractor = registry.getExtractorForFile('src/handlers.rs');

      expect(extractor).toBeDefined();
      expect(extractor!.languageId).toBe('rust');

      const code = `use actix_web::{web, HttpResponse};
use crate::models::User;

pub async fn get_users(pool: web::Data<DbPool>) -> HttpResponse {
    let users = sqlx::query_as::<_, User>("SELECT * FROM users")
        .fetch_all(pool.get_ref())
        .await
        .unwrap();
    HttpResponse::Ok().json(users)
}

pub struct UserService {
    pool: DbPool,
}

impl UserService {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
}
`;

      const units = extractor!.extractCodeUnits(code, 'src/handlers.rs');

      const getUsers = units.find(u => u.name === 'get_users');
      expect(getUsers).toBeDefined();
      expect(getUsers!.unitType).toBe('FUNCTION');
      expect(getUsers!.isAsync).toBe(true);
      expect(getUsers!.isExported).toBe(true);

      const userService = units.find(u => u.name === 'UserService');
      expect(userService).toBeDefined();
      expect(userService!.unitType).toBe('STRUCT');

      const implBlock = units.find(u => u.name === 'impl UserService');
      expect(implBlock).toBeDefined();
      expect(implBlock!.unitType).toBe('IMPL_BLOCK');

      const newMethod = units.find(u => u.name === 'new' && u.unitType === 'METHOD');
      expect(newMethod).toBeDefined();

      const deps = extractor!.extractDependencies(code, 'src/handlers.rs');
      expect(deps.length).toBeGreaterThan(0);

      const actixDep = deps.find(d => d.targetFile.includes('actix_web'));
      expect(actixDep).toBeDefined();

      const patternRules = extractor!.getPatternRules();
      expect(patternRules.apiEndpoints.length).toBeGreaterThan(0);
      expect(patternRules.databaseReads.length).toBeGreaterThan(0);
    });
  });

  describe('C# integration', () => {
    it('should extract classes and methods from C# code', () => {
      const registry = createLanguageRegistry();
      const extractor = registry.getExtractorForFile('Controllers/UsersController.cs');

      expect(extractor).toBeDefined();
      expect(extractor!.languageId).toBe('csharp');

      const code = `using Microsoft.AspNetCore.Mvc;
using MyApp.Models;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<User>>> GetUsers()
    {
        var users = await _context.Users.ToListAsync();
        return Ok(users);
    }

    [HttpPost]
    public async Task<ActionResult<User>> CreateUser(User user)
    {
        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetUsers), user);
    }
}
`;

      const units = extractor!.extractCodeUnits(code, 'Controllers/UsersController.cs');

      const controller = units.find(u => u.name === 'UsersController');
      expect(controller).toBeDefined();
      expect(controller!.unitType).toBe('CLASS');

      const getUsers = units.find(u => u.name === 'GetUsers');
      expect(getUsers).toBeDefined();
      expect(getUsers!.unitType).toBe('METHOD');

      const createUser = units.find(u => u.name === 'CreateUser');
      expect(createUser).toBeDefined();
      expect(createUser!.unitType).toBe('METHOD');

      const deps = extractor!.extractDependencies(code, 'Controllers/UsersController.cs');
      expect(deps.length).toBeGreaterThan(0);

      const mvcDep = deps.find(d =>
        d.targetFile.includes('Microsoft.AspNetCore.Mvc')
      );
      expect(mvcDep).toBeDefined();

      const patternRules = extractor!.getPatternRules();
      expect(patternRules.apiEndpoints.length).toBeGreaterThan(0);
      expect(patternRules.databaseReads.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-language registry behavior', () => {
    it('should aggregate skip directories from all languages', () => {
      const registry = createLanguageRegistry();
      const skipDirs = registry.getAllSkipDirectories();

      // Universal
      expect(skipDirs).toContain('.git');
      expect(skipDirs).toContain('dist');

      // JS/TS
      expect(skipDirs).toContain('node_modules');

      // Python
      expect(skipDirs).toContain('__pycache__');
      expect(skipDirs).toContain('.venv');

      // Go
      expect(skipDirs).toContain('vendor');

      // Java
      expect(skipDirs).toContain('target');

      // Rust
      // target is already covered by Java

      // C#
      expect(skipDirs).toContain('bin');
      expect(skipDirs).toContain('obj');
    });

    it('should correctly identify test files for each language', () => {
      const registry = createLanguageRegistry();

      // JS/TS
      expect(registry.isTestFile('src/utils.test.ts')).toBe(true);
      expect(registry.isTestFile('src/utils.spec.js')).toBe(true);

      // Python
      expect(registry.isTestFile('test_utils.py')).toBe(true);
      expect(registry.isTestFile('utils_test.py')).toBe(true);

      // Go
      expect(registry.isTestFile('main_test.go')).toBe(true);

      // Java
      expect(registry.isTestFile('UserTest.java')).toBe(true);

      // Rust
      expect(registry.isTestFile('tests/main.rs')).toBe(true);

      // C#
      expect(registry.isTestFile('UserTests.cs')).toBe(true);
    });
  });
});
