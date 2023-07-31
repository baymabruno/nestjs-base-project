import { SetMetadata } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const Authorize = (...authorize: string[]) =>
  SetMetadata('roles', authorize);
