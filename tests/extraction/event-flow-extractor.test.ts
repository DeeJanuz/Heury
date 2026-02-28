import { describe, it, expect } from 'vitest';
import { extractEventFlows } from '@/extraction/event-flow-extractor.js';

describe('extractEventFlows', () => {
  describe('node events', () => {
    it('should extract .emit() as node-events emit', () => {
      const code = "emitter.emit('user:created', payload);";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('user:created');
      expect(flows[0].direction).toBe('emit');
      expect(flows[0].framework).toBe('node-events');
      expect(flows[0].lineNumber).toBe(1);
    });

    it('should extract .emit() with double quotes', () => {
      const code = 'emitter.emit("data:ready", result);';
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('data:ready');
      expect(flows[0].direction).toBe('emit');
      expect(flows[0].framework).toBe('node-events');
    });

    it('should extract .on() as node-events subscribe', () => {
      const code = "emitter.on('user:created', handler);";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('user:created');
      expect(flows[0].direction).toBe('subscribe');
      expect(flows[0].framework).toBe('node-events');
    });

    it('should extract .once() as node-events subscribe', () => {
      const code = "emitter.once('connection', callback);";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('connection');
      expect(flows[0].direction).toBe('subscribe');
      expect(flows[0].framework).toBe('node-events');
    });

    it('should extract .addListener() as node-events subscribe', () => {
      const code = "emitter.addListener('error', errorHandler);";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('error');
      expect(flows[0].direction).toBe('subscribe');
      expect(flows[0].framework).toBe('node-events');
    });
  });

  describe('socket.io events', () => {
    it('should extract socket.emit() as socket.io emit', () => {
      const code = "socket.emit('message', data);";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('message');
      expect(flows[0].direction).toBe('emit');
      expect(flows[0].framework).toBe('socket.io');
    });

    it('should extract socket.on() as socket.io subscribe', () => {
      const code = "socket.on('disconnect', () => { });";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('disconnect');
      expect(flows[0].direction).toBe('subscribe');
      expect(flows[0].framework).toBe('socket.io');
    });
  });

  describe('DOM events', () => {
    it('should extract .addEventListener() as dom-events subscribe', () => {
      const code = "element.addEventListener('click', handler);";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('click');
      expect(flows[0].direction).toBe('subscribe');
      expect(flows[0].framework).toBe('dom-events');
    });

    it('should extract .dispatchEvent(new CustomEvent()) as dom-events emit', () => {
      const code = "element.dispatchEvent(new CustomEvent('my-event', { detail: data }));";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('my-event');
      expect(flows[0].direction).toBe('emit');
      expect(flows[0].framework).toBe('dom-events');
    });
  });

  describe('RxJS events', () => {
    it('should extract .subscribe() as rxjs subscribe', () => {
      const code = 'observable.subscribe(value => console.log(value));';
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].direction).toBe('subscribe');
      expect(flows[0].framework).toBe('rxjs');
    });

    it('should extract .next() as rxjs emit', () => {
      const code = "subject.next('value');";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].direction).toBe('emit');
      expect(flows[0].framework).toBe('rxjs');
    });
  });

  describe('pub-sub events', () => {
    it('should extract .publish() as pub-sub emit', () => {
      const code = "broker.publish('topic:updates', payload);";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('topic:updates');
      expect(flows[0].direction).toBe('emit');
      expect(flows[0].framework).toBe('pub-sub');
    });
  });

  describe('redux events', () => {
    it('should extract .dispatch() as redux emit', () => {
      const code = "store.dispatch({ type: 'INCREMENT' });";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].direction).toBe('emit');
      expect(flows[0].framework).toBe('redux');
    });
  });

  describe('event name extraction', () => {
    it('should extract event name from single-quoted string', () => {
      const code = "emitter.emit('my-event', data);";
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('my-event');
    });

    it('should extract event name from double-quoted string', () => {
      const code = 'emitter.on("my-event", handler);';
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('my-event');
    });

    it('should use empty string for event name when no string argument found', () => {
      const code = 'observable.subscribe(handler);';
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('');
    });
  });

  describe('line numbers', () => {
    it('should report correct line numbers for multiple events', () => {
      const code = [
        "emitter.on('start', handler);",
        '// some comment',
        "emitter.emit('done', result);",
      ].join('\n');
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(2);
      expect(flows[0].lineNumber).toBe(1);
      expect(flows[1].lineNumber).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty input', () => {
      const flows = extractEventFlows('');
      expect(flows).toEqual([]);
    });

    it('should skip comment lines', () => {
      const code = [
        "// emitter.emit('fake-event');",
        "emitter.emit('real-event');",
      ].join('\n');
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('real-event');
    });

    it('should skip block comment lines', () => {
      const code = [
        "/* emitter.emit('fake-event'); */",
        "emitter.emit('real-event');",
      ].join('\n');
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(1);
      expect(flows[0].eventName).toBe('real-event');
    });

    it('should extract multiple events from one body', () => {
      const code = [
        "emitter.on('connect', onConnect);",
        "emitter.on('disconnect', onDisconnect);",
        "emitter.emit('ready', true);",
        "socket.emit('join', room);",
        "element.addEventListener('click', onClick);",
      ].join('\n');
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(5);
    });

    it('should handle code with no events', () => {
      const code = [
        'const x = 1;',
        'function foo() { return x; }',
        'console.log(foo());',
      ].join('\n');
      const flows = extractEventFlows(code);
      expect(flows).toEqual([]);
    });

    it('should handle mixed frameworks in one body', () => {
      const code = [
        "emitter.emit('node-event', data);",
        "socket.on('io-event', handler);",
        "element.addEventListener('dom-event', listener);",
        'observable.subscribe(observer);',
        "broker.publish('pub-topic', msg);",
      ].join('\n');
      const flows = extractEventFlows(code);
      expect(flows).toHaveLength(5);

      const frameworks = flows.map(f => f.framework);
      expect(frameworks).toContain('node-events');
      expect(frameworks).toContain('socket.io');
      expect(frameworks).toContain('dom-events');
      expect(frameworks).toContain('rxjs');
      expect(frameworks).toContain('pub-sub');
    });
  });
});
