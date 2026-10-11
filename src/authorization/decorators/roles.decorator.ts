import { Reflector } from '@nestjs/core';
import { Role } from '../../users/enums/role.enum.js';

export const Roles = Reflector.createDecorator<Role[]>();
