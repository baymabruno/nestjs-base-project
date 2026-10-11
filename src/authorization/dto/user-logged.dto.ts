import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../users/enums/role.enum';

export class UserLogged {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ enum: Role, isArray: true })
  roles: Role[];
}
