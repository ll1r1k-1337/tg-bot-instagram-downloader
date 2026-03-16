import { Module } from '@nestjs/common';
import { InstagramService } from './instagram.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [InstagramService],
  exports: [InstagramService],
})
export class InstagramModule {}
