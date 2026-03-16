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
        url: 'https://instagram120.p.rapidapi.com/media/links',
        params: { url: url },
        headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'instagram120.p.rapidapi.com'
        }
      };

      const res = await axios.request(options);

      const data = res.data;
      if (!data || !data.media || data.media.length === 0) {
         throw new Error('No media links found in the Instagram post.');
      }

      const results: DownloadedMedia[] = [];
      for (const media of data.media) {
          const directUrl = media.url;
          if (!directUrl) continue;

          this.logger.log(`Downloading stream from direct URL: ${directUrl.substring(0, 50)}...`);

          const mediaResponse = await axios.get(directUrl, {
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
            }
          });

          // Instagram120 usually returns media type as part of the structure or we can infer from the response
          results.push({
             buffer: Buffer.from(mediaResponse.data),
             type: media.type === 'video' ? 'video' : 'photo' // Assuming `media.type` property exists and can be 'video' or 'photo'
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
