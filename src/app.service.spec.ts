import { readFileSync } from 'fs';
import { join } from 'path';
import { AppService } from './app.service.js';

describe('AppService', () => {
  const service = new AppService();

  it('returns the home page message', () => {
    expect(service.getHello()).toBe('Hello World!');
  });

  it('returns the version from package.json', () => {
    const { version } = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
    );

    expect(service.getVersion()).toBe(version);
  });
});
