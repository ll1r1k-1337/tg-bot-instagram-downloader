import { Module } from '@nestjs/common';
import { BotUpdate } from './bot.update';
import { InstagramModule } from '../instagram/instagram.module';

@Module({
  imports: [InstagramModule],
  providers: [BotUpdate],
})
export class BotModule {}
