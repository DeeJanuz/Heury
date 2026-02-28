import { describe, it, expect } from 'vitest';
import { extractSchemaModels } from '@/extraction/schema-model-extractor.js';

describe('extractSchemaModels', () => {
  describe('general behavior', () => {
    it('should return empty array for empty input', () => {
      const models = extractSchemaModels('', 'schema.prisma');
      expect(models).toEqual([]);
    });

    it('should return empty array for non-schema code', () => {
      const content = `
function hello() {
  return 'world';
}

const x = 42;
`;
      const models = extractSchemaModels(content, 'utils.ts');
      expect(models).toEqual([]);
    });

    it('should not produce false matches from comment lines', () => {
      const content = `
// model User {
//   id Int @id
// }
`;
      const models = extractSchemaModels(content, 'schema.prisma');
      expect(models).toEqual([]);
    });
  });

  describe('Prisma models', () => {
    it('should extract a basic Prisma model with multiple fields', () => {
      const content = `
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]

  @@map("users")
}`;
      const models = extractSchemaModels(content, 'schema.prisma');
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('User');
      expect(models[0].framework).toBe('prisma');
      expect(models[0].tableName).toBe('users');
      expect(models[0].fields).toHaveLength(4);

      const idField = models[0].fields.find(f => f.name === 'id');
      expect(idField).toBeDefined();
      expect(idField!.fieldType).toBe('Int');
      expect(idField!.isPrimaryKey).toBe(true);
      expect(idField!.hasDefault).toBe(true);
      expect(idField!.isRequired).toBe(true);

      const emailField = models[0].fields.find(f => f.name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField!.fieldType).toBe('String');
      expect(emailField!.isUnique).toBe(true);
      expect(emailField!.isRequired).toBe(true);

      const nameField = models[0].fields.find(f => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField!.fieldType).toBe('String');
      expect(nameField!.isRequired).toBe(false);

      const postsField = models[0].fields.find(f => f.name === 'posts');
      expect(postsField).toBeDefined();
      expect(postsField!.fieldType).toBe('Post[]');
    });

    it('should detect Prisma primary key', () => {
      const content = `
model Post {
  id Int @id
}`;
      const models = extractSchemaModels(content, 'schema.prisma');
      expect(models).toHaveLength(1);
      expect(models[0].fields[0].isPrimaryKey).toBe(true);
    });

    it('should detect Prisma unique fields', () => {
      const content = `
model Account {
  slug String @unique
}`;
      const models = extractSchemaModels(content, 'schema.prisma');
      expect(models[0].fields[0].isUnique).toBe(true);
    });

    it('should detect Prisma required vs optional fields', () => {
      const content = `
model Profile {
  bio     String?
  website String
}`;
      const models = extractSchemaModels(content, 'schema.prisma');
      const bioField = models[0].fields.find(f => f.name === 'bio');
      const websiteField = models[0].fields.find(f => f.name === 'website');
      expect(bioField!.isRequired).toBe(false);
      expect(websiteField!.isRequired).toBe(true);
    });

    it('should detect Prisma default values', () => {
      const content = `
model Post {
  createdAt DateTime @default(now())
  published Boolean  @default(false)
}`;
      const models = extractSchemaModels(content, 'schema.prisma');
      expect(models[0].fields[0].hasDefault).toBe(true);
      expect(models[0].fields[1].hasDefault).toBe(true);
    });

    it('should detect Prisma relation fields', () => {
      const content = `
model Post {
  author   User @relation(fields: [authorId], references: [id])
  authorId Int
}`;
      const models = extractSchemaModels(content, 'schema.prisma');
      const authorField = models[0].fields.find(f => f.name === 'author');
      expect(authorField!.relationTarget).toBe('User');
    });

    it('should detect Prisma table name mapping', () => {
      const content = `
model UserProfile {
  id Int @id

  @@map("user_profiles")
}`;
      const models = extractSchemaModels(content, 'schema.prisma');
      expect(models[0].tableName).toBe('user_profiles');
    });

    it('should report correct line number for Prisma model', () => {
      const content = `
// This is a schema file

model User {
  id Int @id
}`;
      const models = extractSchemaModels(content, 'schema.prisma');
      expect(models[0].lineNumber).toBe(4);
    });

    it('should handle empty Prisma model', () => {
      const content = `
model Empty {
}`;
      const models = extractSchemaModels(content, 'schema.prisma');
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('Empty');
      expect(models[0].fields).toHaveLength(0);
    });

    it('should extract multiple Prisma models from one file', () => {
      const content = `
model User {
  id   Int    @id
  name String
}

model Post {
  id    Int    @id
  title String
}

model Comment {
  id   Int    @id
  body String
}`;
      const models = extractSchemaModels(content, 'schema.prisma');
      expect(models).toHaveLength(3);
      expect(models[0].name).toBe('User');
      expect(models[1].name).toBe('Post');
      expect(models[2].name).toBe('Comment');
    });

    it('should detect Prisma by .prisma file extension', () => {
      const content = `
model Widget {
  id Int @id
}`;
      const models = extractSchemaModels(content, 'db/my-schema.prisma');
      expect(models).toHaveLength(1);
      expect(models[0].framework).toBe('prisma');
    });

    it('should not produce false matches from commented Prisma models', () => {
      const content = `
// model Fake {
//   id Int @id
// }

model Real {
  id Int @id
}`;
      const models = extractSchemaModels(content, 'schema.prisma');
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('Real');
    });
  });

  describe('TypeORM entities', () => {
    it('should extract a basic TypeORM entity', () => {
      const content = `
@Entity('users')
class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  bio: string;

  @ManyToOne(() => Organization)
  organization: Organization;
}`;
      const models = extractSchemaModels(content, 'user.entity.ts');
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('User');
      expect(models[0].framework).toBe('typeorm');
      expect(models[0].tableName).toBe('users');
      expect(models[0].fields).toHaveLength(4);

      const idField = models[0].fields.find(f => f.name === 'id');
      expect(idField).toBeDefined();
      expect(idField!.isPrimaryKey).toBe(true);
      expect(idField!.hasDefault).toBe(true);

      const emailField = models[0].fields.find(f => f.name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField!.isUnique).toBe(true);
      expect(emailField!.isRequired).toBe(true);

      const bioField = models[0].fields.find(f => f.name === 'bio');
      expect(bioField).toBeDefined();
      expect(bioField!.isRequired).toBe(false);

      const orgField = models[0].fields.find(f => f.name === 'organization');
      expect(orgField).toBeDefined();
      expect(orgField!.relationTarget).toBe('Organization');
    });

    it('should detect TypeORM PrimaryColumn', () => {
      const content = `
@Entity()
class Config {
  @PrimaryColumn()
  key: string;
}`;
      const models = extractSchemaModels(content, 'config.entity.ts');
      expect(models[0].fields[0].isPrimaryKey).toBe(true);
      expect(models[0].fields[0].hasDefault).toBe(false);
    });

    it('should detect TypeORM unique columns', () => {
      const content = `
@Entity()
class Account {
  @Column({ unique: true })
  slug: string;
}`;
      const models = extractSchemaModels(content, 'account.entity.ts');
      expect(models[0].fields[0].isUnique).toBe(true);
    });

    it('should detect TypeORM nullable columns as not required', () => {
      const content = `
@Entity()
class Profile {
  @Column({ nullable: true })
  avatar: string;

  @Column()
  name: string;
}`;
      const models = extractSchemaModels(content, 'profile.entity.ts');
      const avatarField = models[0].fields.find(f => f.name === 'avatar');
      const nameField = models[0].fields.find(f => f.name === 'name');
      expect(avatarField!.isRequired).toBe(false);
      expect(nameField!.isRequired).toBe(true);
    });

    it('should detect TypeORM default values', () => {
      const content = `
@Entity()
class Post {
  @Column({ default: true })
  published: boolean;
}`;
      const models = extractSchemaModels(content, 'post.entity.ts');
      expect(models[0].fields[0].hasDefault).toBe(true);
    });

    it('should detect TypeORM relation decorators', () => {
      const content = `
@Entity()
class Post {
  @ManyToOne(() => User)
  author: User;

  @OneToMany(() => Comment)
  comments: Comment[];

  @OneToOne(() => PostMeta)
  meta: PostMeta;

  @ManyToMany(() => Tag)
  tags: Tag[];
}`;
      const models = extractSchemaModels(content, 'post.entity.ts');
      const authorField = models[0].fields.find(f => f.name === 'author');
      const commentsField = models[0].fields.find(f => f.name === 'comments');
      const metaField = models[0].fields.find(f => f.name === 'meta');
      const tagsField = models[0].fields.find(f => f.name === 'tags');
      expect(authorField!.relationTarget).toBe('User');
      expect(commentsField!.relationTarget).toBe('Comment');
      expect(metaField!.relationTarget).toBe('PostMeta');
      expect(tagsField!.relationTarget).toBe('Tag');
    });

    it('should extract TypeORM entity without table name argument', () => {
      const content = `
@Entity()
class Product {
  @PrimaryGeneratedColumn()
  id: number;
}`;
      const models = extractSchemaModels(content, 'product.entity.ts');
      expect(models[0].name).toBe('Product');
      expect(models[0].tableName).toBeUndefined();
    });

    it('should report correct line number for TypeORM entity', () => {
      const content = `
import { Entity } from 'typeorm';

@Entity()
class User {
  @PrimaryGeneratedColumn()
  id: number;
}`;
      const models = extractSchemaModels(content, 'user.entity.ts');
      expect(models[0].lineNumber).toBe(4);
    });

    it('should handle empty TypeORM entity', () => {
      const content = `
@Entity()
class Empty {
}`;
      const models = extractSchemaModels(content, 'empty.entity.ts');
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('Empty');
      expect(models[0].fields).toHaveLength(0);
    });

    it('should extract multiple TypeORM entities from one file', () => {
      const content = `
@Entity('users')
class User {
  @PrimaryGeneratedColumn()
  id: number;
}

@Entity('posts')
class Post {
  @PrimaryGeneratedColumn()
  id: number;
}`;
      const models = extractSchemaModels(content, 'entities.ts');
      expect(models).toHaveLength(2);
      expect(models[0].name).toBe('User');
      expect(models[1].name).toBe('Post');
    });
  });

  describe('Mongoose schemas', () => {
    it('should extract a basic Mongoose schema', () => {
      const content = `
const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },
  age: { type: Number, default: 0 },
  organization: { type: Schema.Types.ObjectId, ref: 'Organization' }
});`;
      const models = extractSchemaModels(content, 'user.model.js');
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('user');
      expect(models[0].framework).toBe('mongoose');
      expect(models[0].fields).toHaveLength(4);

      const nameField = models[0].fields.find(f => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField!.fieldType).toBe('String');
      expect(nameField!.isRequired).toBe(true);

      const emailField = models[0].fields.find(f => f.name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField!.isUnique).toBe(true);

      const ageField = models[0].fields.find(f => f.name === 'age');
      expect(ageField).toBeDefined();
      expect(ageField!.hasDefault).toBe(true);

      const orgField = models[0].fields.find(f => f.name === 'organization');
      expect(orgField).toBeDefined();
      expect(orgField!.relationTarget).toBe('Organization');
    });

    it('should detect Mongoose primary key (_id field)', () => {
      const content = `
const itemSchema = new Schema({
  _id: { type: String },
  name: String
});`;
      const models = extractSchemaModels(content, 'item.model.js');
      const idField = models[0].fields.find(f => f.name === '_id');
      expect(idField!.isPrimaryKey).toBe(true);
    });

    it('should detect Mongoose unique fields', () => {
      const content = `
const accountSchema = new Schema({
  email: { type: String, unique: true }
});`;
      const models = extractSchemaModels(content, 'account.model.js');
      expect(models[0].fields[0].isUnique).toBe(true);
    });

    it('should detect Mongoose required fields', () => {
      const content = `
const productSchema = new Schema({
  name: { type: String, required: true },
  description: String
});`;
      const models = extractSchemaModels(content, 'product.model.js');
      const nameField = models[0].fields.find(f => f.name === 'name');
      const descField = models[0].fields.find(f => f.name === 'description');
      expect(nameField!.isRequired).toBe(true);
      expect(descField!.isRequired).toBe(false);
    });

    it('should detect Mongoose default values', () => {
      const content = `
const settingsSchema = new Schema({
  theme: { type: String, default: 'light' },
  notifications: { type: Boolean, default: true }
});`;
      const models = extractSchemaModels(content, 'settings.model.js');
      expect(models[0].fields[0].hasDefault).toBe(true);
      expect(models[0].fields[1].hasDefault).toBe(true);
    });

    it('should detect Mongoose relation (ref) fields', () => {
      const content = `
const postSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: 'User' }
});`;
      const models = extractSchemaModels(content, 'post.model.js');
      expect(models[0].fields[0].relationTarget).toBe('User');
    });

    it('should handle simple Mongoose field types', () => {
      const content = `
const simpleSchema = new Schema({
  title: String,
  count: Number,
  active: Boolean
});`;
      const models = extractSchemaModels(content, 'simple.model.js');
      expect(models[0].fields).toHaveLength(3);
      const titleField = models[0].fields.find(f => f.name === 'title');
      expect(titleField!.fieldType).toBe('String');
      const countField = models[0].fields.find(f => f.name === 'count');
      expect(countField!.fieldType).toBe('Number');
      const activeField = models[0].fields.find(f => f.name === 'active');
      expect(activeField!.fieldType).toBe('Boolean');
    });

    it('should strip Schema suffix from Mongoose variable name for model name', () => {
      const content = `
const blogPostSchema = new Schema({
  title: String
});`;
      const models = extractSchemaModels(content, 'blog-post.model.js');
      expect(models[0].name).toBe('blogPost');
    });

    it('should report correct line number for Mongoose schema', () => {
      const content = `
const mongoose = require('mongoose');

const userSchema = new Schema({
  name: String
});`;
      const models = extractSchemaModels(content, 'user.model.js');
      expect(models[0].lineNumber).toBe(4);
    });

    it('should handle empty Mongoose schema', () => {
      const content = `
const emptySchema = new Schema({
});`;
      const models = extractSchemaModels(content, 'empty.model.js');
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('empty');
      expect(models[0].fields).toHaveLength(0);
    });

    it('should detect mongoose.Schema variant', () => {
      const content = `
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true }
});`;
      const models = extractSchemaModels(content, 'user.model.js');
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('user');
      expect(models[0].framework).toBe('mongoose');
      expect(models[0].fields).toHaveLength(2);
    });

    it('should extract multiple Mongoose schemas from one file', () => {
      const content = `
const userSchema = new Schema({
  name: String
});

const postSchema = new Schema({
  title: String
});`;
      const models = extractSchemaModels(content, 'schemas.js');
      expect(models).toHaveLength(2);
      expect(models[0].name).toBe('user');
      expect(models[1].name).toBe('post');
    });
  });

  describe('Drizzle tables', () => {
    it('should extract a basic Drizzle pgTable', () => {
      const content = `
export const users = pgTable('users', {
  id: integer('id').primaryKey(),
  email: text('email').unique().notNull(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').default(sql\`now()\`),
  orgId: integer('org_id').references(() => organizations.id),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('users');
      expect(models[0].framework).toBe('drizzle');
      expect(models[0].tableName).toBe('users');
      expect(models[0].fields).toHaveLength(5);

      const idField = models[0].fields.find(f => f.name === 'id');
      expect(idField).toBeDefined();
      expect(idField!.fieldType).toBe('integer');
      expect(idField!.isPrimaryKey).toBe(true);

      const emailField = models[0].fields.find(f => f.name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField!.fieldType).toBe('text');
      expect(emailField!.isUnique).toBe(true);
      expect(emailField!.isRequired).toBe(true);

      const nameField = models[0].fields.find(f => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField!.fieldType).toBe('varchar');
      expect(nameField!.isRequired).toBe(false);

      const createdAtField = models[0].fields.find(f => f.name === 'createdAt');
      expect(createdAtField).toBeDefined();
      expect(createdAtField!.hasDefault).toBe(true);

      const orgIdField = models[0].fields.find(f => f.name === 'orgId');
      expect(orgIdField).toBeDefined();
      expect(orgIdField!.relationTarget).toBe('organizations');
    });

    it('should detect Drizzle primary key', () => {
      const content = `
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models[0].fields[0].isPrimaryKey).toBe(true);
    });

    it('should detect Drizzle unique fields', () => {
      const content = `
export const accounts = pgTable('accounts', {
  slug: text('slug').unique(),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models[0].fields[0].isUnique).toBe(true);
    });

    it('should detect Drizzle notNull as required', () => {
      const content = `
export const items = pgTable('items', {
  name: text('name').notNull(),
  description: text('description'),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      const nameField = models[0].fields.find(f => f.name === 'name');
      const descField = models[0].fields.find(f => f.name === 'description');
      expect(nameField!.isRequired).toBe(true);
      expect(descField!.isRequired).toBe(false);
    });

    it('should detect Drizzle default values', () => {
      const content = `
export const configs = pgTable('configs', {
  active: boolean('active').default(true),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models[0].fields[0].hasDefault).toBe(true);
    });

    it('should detect Drizzle references', () => {
      const content = `
export const comments = pgTable('comments', {
  postId: integer('post_id').references(() => posts.id),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models[0].fields[0].relationTarget).toBe('posts');
    });

    it('should extract Drizzle table name from first string argument', () => {
      const content = `
export const userProfiles = pgTable('user_profiles', {
  id: integer('id').primaryKey(),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models[0].name).toBe('userProfiles');
      expect(models[0].tableName).toBe('user_profiles');
    });

    it('should report correct line number for Drizzle table', () => {
      const content = `
import { pgTable, integer, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: integer('id').primaryKey(),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models[0].lineNumber).toBe(4);
    });

    it('should handle empty Drizzle table', () => {
      const content = `
export const empty = pgTable('empty', {
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('empty');
      expect(models[0].fields).toHaveLength(0);
    });

    it('should detect mysqlTable variant', () => {
      const content = `
export const products = mysqlTable('products', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models).toHaveLength(1);
      expect(models[0].framework).toBe('drizzle');
      expect(models[0].name).toBe('products');
    });

    it('should detect sqliteTable variant', () => {
      const content = `
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models).toHaveLength(1);
      expect(models[0].framework).toBe('drizzle');
      expect(models[0].name).toBe('tasks');
    });

    it('should extract multiple Drizzle tables from one file', () => {
      const content = `
export const users = pgTable('users', {
  id: integer('id').primaryKey(),
});

export const posts = pgTable('posts', {
  id: integer('id').primaryKey(),
});

export const comments = pgTable('comments', {
  id: integer('id').primaryKey(),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models).toHaveLength(3);
      expect(models[0].name).toBe('users');
      expect(models[1].name).toBe('posts');
      expect(models[2].name).toBe('comments');
    });

    it('should extract Drizzle field types from various type functions', () => {
      const content = `
export const mixed = pgTable('mixed', {
  id: serial('id').primaryKey(),
  label: text('label'),
  count: integer('count'),
  slug: varchar('slug', { length: 100 }),
  active: boolean('active'),
  createdAt: timestamp('created_at'),
});`;
      const models = extractSchemaModels(content, 'schema.ts');
      expect(models[0].fields).toHaveLength(6);

      const types = models[0].fields.map(f => ({ name: f.name, fieldType: f.fieldType }));
      expect(types).toContainEqual({ name: 'id', fieldType: 'serial' });
      expect(types).toContainEqual({ name: 'label', fieldType: 'text' });
      expect(types).toContainEqual({ name: 'count', fieldType: 'integer' });
      expect(types).toContainEqual({ name: 'slug', fieldType: 'varchar' });
      expect(types).toContainEqual({ name: 'active', fieldType: 'boolean' });
      expect(types).toContainEqual({ name: 'createdAt', fieldType: 'timestamp' });
    });
  });

  describe('framework detection via filePath', () => {
    it('should detect Prisma by .prisma extension', () => {
      const content = `
model User {
  id Int @id
}`;
      const models = extractSchemaModels(content, 'prisma/schema.prisma');
      expect(models[0].framework).toBe('prisma');
    });

    it('should not detect Prisma model syntax in non-prisma files', () => {
      const content = `
model User {
  id Int @id
}`;
      // In a .ts file, 'model User {' is not Prisma — it's unknown
      const models = extractSchemaModels(content, 'models.ts');
      expect(models).toHaveLength(0);
    });
  });
});
