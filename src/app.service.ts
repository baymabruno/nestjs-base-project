import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AppService {
  private readonly version: string = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
  ).version;

  getHello(): string {
    return 'Hello World!';
  }

  getVersion(): string {
    return this.version;
  }
}
