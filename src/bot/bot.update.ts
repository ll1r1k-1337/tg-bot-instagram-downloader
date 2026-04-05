import { Update, Ctx, Start, Help, On } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Logger } from '@nestjs/common';
import { InstagramService } from '../instagram/instagram.service';

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(private readonly instagramService: InstagramService) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    await ctx.reply(
      'Привет! Отправь мне ссылку на Instagram Reels, Video или Photo, и я скачаю их для тебя!',
    );
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    await ctx.reply(
      'Просто отправь мне валидную ссылку на пост в Instagram. Например: https://www.instagram.com/reel/C3_Y_w7R06o/',
    );
  }

  @On('text')
  async onText(@Ctx() ctx: Context) {
    const messageObj = ctx;

    const text = messageObj.text;

    if (!text) {
      this.logger.debug(
        'Received update without text message object, ignoring.',
      );
      return;
    }

    const message_id = messageObj.message?.message_id;

    if (!message_id) {
      this.logger.debug('Received update without message_id, ignoring.');
      return;
    }

    const userId = messageObj.from?.id;
    this.logger.debug(`Received text message from user ${userId}: "${text}"`);

    const urlPattern =
      /(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv|stories)\/[^/?#&]+)/;
    const match = text.match(urlPattern);

    if (!match) {
      this.logger.warn(
        `No valid Instagram URL found in text from user ${userId}`,
      );
      await ctx.reply(
        'Пожалуйста, отправь правильную ссылку на Instagram видео или фото.',
      );
      return;
    }

    const url = match[0];
    this.logger.debug(`Parsed Instagram URL: ${url}`);

    const waitMessage = await ctx.reply(
      '⏳ Скачиваю медиа... Пожалуйста, подождите.',
      { reply_parameters: { message_id } },
    );

    try {
      this.logger.log(
        `Initiating download request for URL: ${url} (User: ${userId})`,
      );
      const mediaList = await this.instagramService.downloadMedia(url);

      this.logger.log(
        `Successfully downloaded ${mediaList.length} media item(s) for URL: ${url}`,
      );

      if (mediaList.length === 1) {
        const media = mediaList[0];
        if (media.type === 'video') {
          this.logger.log(`Sending video back to user ${userId}`);
          await ctx.replyWithVideo(
            { source: media.buffer },
            { reply_parameters: { message_id } },
          );
          this.logger.verbose(`Successfully sent video to user ${userId}`);
        } else {
          this.logger.log(`Sending photo back to user ${userId}`);
          await ctx.replyWithPhoto(
            { source: media.buffer },
            { reply_parameters: { message_id } },
          );
          this.logger.verbose(`Successfully sent photo to user ${userId}`);
        }
      } else {
        // Send as media group if there are multiple items
        this.logger.log(
          `Sending media group (${mediaList.length} items) back to user ${userId}`,
        );
        const mediaGroup: any[] = mediaList.map((media) => ({
          type: media.type === 'video' ? 'video' : 'photo',
          media: { source: media.buffer },
        }));

        await ctx.replyWithMediaGroup(mediaGroup, {
          reply_parameters: { message_id },
        });
        this.logger.verbose(`Successfully sent media group to user ${userId}`);
      }
    } catch (error: unknown) {
      let errorMessage = 'Неизвестная ошибка';
      if (error instanceof Error) {
        this.logger.error(
          `Error processing url ${url} for user ${userId}: ${error.message}`,
          error.stack,
        );
        errorMessage = error.message;
      }

      await ctx.reply(
        `❌ Ошибка: ${errorMessage}. Возможно, аккаунт приватный, ссылка неверна, или сервис временно недоступен.`,
        { reply_parameters: { message_id } },
      );
    } finally {
      // Optional: delete the "processing" message
      try {
        if (ctx.chat) {
          await ctx.telegram.deleteMessage(ctx.chat.id, waitMessage.message_id);
          this.logger.debug(
            `Deleted wait message ${waitMessage.message_id} in chat ${ctx.chat.id}`,
          );
        }
      } catch (e: unknown) {
        if (e instanceof Error) {
          this.logger.warn(
            `Failed to delete wait message ${waitMessage.message_id}: ${e.message}`,
          );
        } else {
          this.logger.warn(
            `Failed to delete wait message ${waitMessage.message_id}: ${JSON.stringify(e)}`,
          );
        }
      }
    }
  }
}
