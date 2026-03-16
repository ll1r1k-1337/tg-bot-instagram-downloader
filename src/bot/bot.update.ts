import { Update, Ctx, Start, Help, On, Message } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Logger } from '@nestjs/common';
import { InstagramService } from '../instagram/instagram.service';

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(private readonly instagramService: InstagramService) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    await ctx.reply('Привет! Отправь мне ссылку на Instagram Reels, Video или Photo, и я скачаю их для тебя!');
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    await ctx.reply('Просто отправь мне валидную ссылку на пост в Instagram. Например: https://www.instagram.com/reel/C3_Y_w7R06o/');
  }

  @On('text')
  async onText(@Ctx() ctx: Context) {
    const messageObj = ctx.message as any;
    if (!messageObj || !messageObj.text) return;

    const text = messageObj.text;
    const urlPattern = /(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv|stories)\/[^\/?#&]+)/;
    const match = text.match(urlPattern);

    if (!match) {
      await ctx.reply('Пожалуйста, отправь правильную ссылку на Instagram видео или фото.');
      return;
    }

    const url = match[0];
    const waitMessage = await ctx.reply('⏳ Скачиваю медиа... Пожалуйста, подождите.', { reply_parameters: { message_id: messageObj.message_id } });

    try {
      this.logger.log(`Processing request for: ${url}`);
      const mediaList = await this.instagramService.downloadMedia(url);

      if (mediaList.length === 1) {
          const media = mediaList[0];
          if (media.type === 'video') {
              await ctx.replyWithVideo(
                 { source: media.buffer },
                 { reply_parameters: { message_id: messageObj.message_id } }
              );
          } else {
              await ctx.replyWithPhoto(
                 { source: media.buffer },
                 { reply_parameters: { message_id: messageObj.message_id } }
              );
          }
      } else {
          // Send as media group if there are multiple items
          const mediaGroup: any[] = mediaList.map(media => ({
              type: media.type === 'video' ? 'video' : 'photo',
              media: { source: media.buffer }
          }));

          await ctx.replyWithMediaGroup(mediaGroup, {
             reply_parameters: { message_id: messageObj.message_id }
          });
      }

    } catch (error: any) {
      this.logger.error(`Error processing url ${url}: ${error.message}`);
      await ctx.reply(`❌ Ошибка: ${error.message}. Возможно, аккаунт приватный, ссылка неверна, или сервис временно недоступен.`, { reply_parameters: { message_id: messageObj.message_id } });
    } finally {
       // Optional: delete the "processing" message
       try {
           if (ctx.chat) {
               await ctx.telegram.deleteMessage(ctx.chat.id, waitMessage.message_id);
           }
       } catch(e) {}
    }
  }
}
