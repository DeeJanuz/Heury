import { describe, it, expect } from 'vitest';
import { PatternType } from '@/domain/models/index.js';
import {
  SQL_READ_PATTERNS,
  SQL_WRITE_PATTERNS,
  EXTERNAL_SERVICE_PATTERNS,
} from '@/extraction/shared/pattern-rules-shared.js';

describe('SQL_READ_PATTERNS', () => {
  it('should detect SELECT queries as DATABASE_READ', () => {
    const code = 'db.query("SELECT id, name FROM users WHERE active = true")';
    const rule = SQL_READ_PATTERNS[0];
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    const match = regex.exec(code);
    expect(match).not.toBeNull();
    expect(rule.patternType).toBe(PatternType.DATABASE_READ);
    expect(match![1]).toBe('users');
  });

  it('should match SELECT with different columns', () => {
    const code = 'SELECT * FROM orders';
    const rule = SQL_READ_PATTERNS[0];
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    const match = regex.exec(code);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('orders');
  });
});

describe('SQL_WRITE_PATTERNS', () => {
  it('should detect INSERT INTO as DATABASE_WRITE', () => {
    const code = 'INSERT INTO users (name, email) VALUES (?, ?)';
    const insertRule = SQL_WRITE_PATTERNS[0];
    const regex = new RegExp(insertRule.pattern.source, insertRule.pattern.flags);
    const match = regex.exec(code);
    expect(match).not.toBeNull();
    expect(insertRule.patternType).toBe(PatternType.DATABASE_WRITE);
    expect(match![1]).toBe('users');
  });

  it('should detect UPDATE SET as DATABASE_WRITE', () => {
    const code = 'UPDATE users SET name = ? WHERE id = ?';
    const updateRule = SQL_WRITE_PATTERNS[1];
    const regex = new RegExp(updateRule.pattern.source, updateRule.pattern.flags);
    const match = regex.exec(code);
    expect(match).not.toBeNull();
    expect(updateRule.patternType).toBe(PatternType.DATABASE_WRITE);
    expect(match![1]).toBe('users');
  });

  it('should detect DELETE FROM as DATABASE_WRITE', () => {
    const code = 'DELETE FROM sessions WHERE expired = true';
    const deleteRule = SQL_WRITE_PATTERNS[2];
    const regex = new RegExp(deleteRule.pattern.source, deleteRule.pattern.flags);
    const match = regex.exec(code);
    expect(match).not.toBeNull();
    expect(deleteRule.patternType).toBe(PatternType.DATABASE_WRITE);
    expect(match![1]).toBe('sessions');
  });
});

describe('EXTERNAL_SERVICE_PATTERNS', () => {
  it('should detect Stripe API calls', () => {
    const code = 'stripe.customers.create({ email: user.email })';
    const stripeRule = EXTERNAL_SERVICE_PATTERNS[0];
    const regex = new RegExp(stripeRule.pattern.source, stripeRule.pattern.flags);
    const match = regex.exec(code);
    expect(match).not.toBeNull();
    expect(stripeRule.patternType).toBe(PatternType.EXTERNAL_SERVICE);
  });

  it('should detect OpenAI API calls', () => {
    const code = 'openai.chat.create({ model: "gpt-4" })';
    const openaiRule = EXTERNAL_SERVICE_PATTERNS[1];
    const regex = new RegExp(openaiRule.pattern.source, openaiRule.pattern.flags);
    const match = regex.exec(code);
    expect(match).not.toBeNull();
    expect(openaiRule.patternType).toBe(PatternType.EXTERNAL_SERVICE);
  });

  it('should detect Twilio API calls', () => {
    const code = 'twilio.messages.create({ body: "Hello" })';
    const twilioRule = EXTERNAL_SERVICE_PATTERNS[2];
    const regex = new RegExp(twilioRule.pattern.source, twilioRule.pattern.flags);
    const match = regex.exec(code);
    expect(match).not.toBeNull();
    expect(twilioRule.patternType).toBe(PatternType.EXTERNAL_SERVICE);
  });

  it('should detect Firebase API calls', () => {
    const code = 'firebase.auth()';
    const firebaseRule = EXTERNAL_SERVICE_PATTERNS[3];
    const regex = new RegExp(firebaseRule.pattern.source, firebaseRule.pattern.flags);
    const match = regex.exec(code);
    expect(match).not.toBeNull();
    expect(firebaseRule.patternType).toBe(PatternType.EXTERNAL_SERVICE);
  });
});
