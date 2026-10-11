import { ApiProperty } from '@nestjs/swagger';

export class LoginResponse {
  @ApiProperty()
  access_token: string;
}
