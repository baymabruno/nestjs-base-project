import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UserLogin {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username: string;

  // bcrypt only uses the first 72 bytes of the password
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
