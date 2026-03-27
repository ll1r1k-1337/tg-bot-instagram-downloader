import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

export interface DownloadedMedia {
  buffer: Buffer;
  type: 'video' | 'photo';
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(private configService: ConfigService) {}

  async downloadMedia(url: string): Promise<DownloadedMedia[]> {
    try {
      this.logger.log(`Fetching direct URL for: ${url}`);

      const rapidApiKey = this.configService.get<string>('RAPIDAPI_KEY');
      if (!rapidApiKey) {
          throw new Error('RapidAPI Key is not configured.');
      }

      const options = {
        method: 'GET',
        url: 'https://instagram-reels-downloader-api.p.rapidapi.com/download',
        params: { url: url },
        headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'instagram-reels-downloader-api.p.rapidapi.com'
        }
      };

      const res = await axios.request(options);

      const responseData = res.data;
      const data = responseData.data || responseData;

      if (!data || !data.medias || data.medias.length === 0) {
         throw new Error('No media links found in the Instagram post.');
      }

      const results: DownloadedMedia[] = [];
      for (const media of data.medias) {
          if (media.type === 'audio' || media.extension === 'm4a') {
              continue;
          }
          const directUrl = media.url;
          if (!directUrl) continue;

          this.logger.log(`Downloading stream from direct URL: ${directUrl.substring(0, 50)}...`);

          const mediaResponse = await axios.get(directUrl, {
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
            }
          });

          // EaseApi returns media type as part of the structure ('video' or 'image')
          let mediaType: 'video' | 'photo' = 'photo';
          if (media.type === 'video' || media.extension === 'mp4') {
             mediaType = 'video';
          }

          results.push({
             buffer: Buffer.from(mediaResponse.data),
             type: mediaType
          });
      }

      if (results.length === 0) {
         throw new Error('Failed to download any media files.');
      }

      return results;
    } catch (error: any) {
      this.logger.error(`Error downloading Instagram media: ${error.message}`);
      throw new Error(`Failed to download media: ${error.response?.data?.message || error.message}`);
    }
  }
}
