import { SetMetadata } from '@nestjs/common';

export const Authorize = (...authorize: string[]) =>
  SetMetadata('roles', authorize);
