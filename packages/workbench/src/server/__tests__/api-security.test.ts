import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import { isPathWithin, ClientError, parseJsonBody } from '../api-middleware.js';

describe('@spectra/workbench - API security helpers ($0.00 Spend)', () => {
  it('confines caller paths within the allowed root', () => {
    const root = path.resolve('benchmark');
    expect(isPathWithin(path.join(root, 'clips', 'a.png'), root)).toBe(true);
    expect(isPathWithin(path.resolve('.env'), root)).toBe(false);
    expect(isPathWithin(path.join(root, '..', '.env'), root)).toBe(false);
    expect(isPathWithin(root, root)).toBe(false);
  });

  it('ClientError carries a safe status and message', () => {
    const err = new ClientError('bad input');
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('bad input');
    expect(new ClientError('too big', 413).statusCode).toBe(413);
  });

  it('parseJsonBody rejects and destroys oversize streams', async () => {
    const req = new EventEmitter() as unknown as IncomingMessage;
    let destroyed = false;
    req.destroy = () => {
      destroyed = true;
      return req;
    };
    const pending = parseJsonBody(req, 10);
    req.emit('data', Buffer.from('x'.repeat(64)));
    await expect(pending).rejects.toThrow('Payload too large');
    expect(destroyed).toBe(true);
  });
});
