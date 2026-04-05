import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

export interface DownloadedMedia {
  buffer: Buffer;
  type: 'video' | 'photo';
}

interface RapidApiMediaItem {
  type?: string;
  extension?: string;
  url?: string;
}

interface RapidApiResponse {
  data?: {
    medias?: RapidApiMediaItem[];
  };
  medias?: RapidApiMediaItem[];
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(private configService: ConfigService) {}

  async downloadMedia(url: string): Promise<DownloadedMedia[]> {
    try {
      this.logger.log(`Fetching direct URL via RapidAPI for: ${url}`);

      const rapidApiKey = this.configService.get<string>('RAPIDAPI_KEY');
      if (!rapidApiKey) {
        this.logger.error('RapidAPI Key is missing in environment variables.');
        throw new Error('RapidAPI Key is not configured.');
      }

      const options = {
        method: 'GET',
        url: 'https://instagram-reels-downloader-api.p.rapidapi.com/download',
        params: { url: url },
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'instagram-reels-downloader-api.p.rapidapi.com',
        },
      };

      this.logger.debug(
        `Sending request to RapidAPI with URL parameter: ${url}`,
      );
      const res = await axios.request<RapidApiResponse>(options);
      this.logger.debug(
        `Received response from RapidAPI with status: ${res.status}`,
      );

      const responseData = res.data;
      const data = responseData.data || responseData;

      if (!data || !data.medias || data.medias.length === 0) {
        this.logger.warn(
          `RapidAPI response contained no medias array for URL: ${url}`,
        );
        throw new Error('No media links found in the Instagram post.');
      }

      this.logger.log(
        `RapidAPI returned ${data.medias.length} media item(s). Iterating over them.`,
      );
      const results: DownloadedMedia[] = [];

      for (const [index, media] of data.medias.entries()) {
        this.logger.verbose(
          `Inspecting media item ${index}: type=${media.type}, extension=${media.extension}`,
        );
        if (media.type === 'audio' || media.extension === 'm4a') {
          this.logger.warn(
            `Skipping media item ${index} due to unsupported audio type.`,
          );
          continue;
        }
        const directUrl = media.url;
        if (!directUrl) {
          this.logger.warn(
            `Skipping media item ${index} because the URL is empty or undefined.`,
          );
          continue;
        }

        this.logger.log(
          `Downloading stream from direct URL for item ${index}: ${directUrl.substring(0, 50)}...`,
        );

        const mediaResponse = await axios.get<ArrayBuffer>(directUrl, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
          },
        });

        this.logger.debug(
          `Downloaded stream for item ${index} with status: ${mediaResponse.status}`,
        );

        // EaseApi returns media type as part of the structure ('video' or 'image')
        let mediaType: 'video' | 'photo' = 'photo';
        if (media.type === 'video' || media.extension === 'mp4') {
          mediaType = 'video';
        }
        this.logger.verbose(
          `Resolved media type for item ${index} to: ${mediaType}`,
        );

        results.push({
          buffer: Buffer.from(mediaResponse.data),
          type: mediaType,
        });
      }

      if (results.length === 0) {
        this.logger.error(
          `No supported media files were downloaded for URL: ${url}`,
        );
        throw new Error('Failed to download any media files.');
      }

      this.logger.log(
        `Successfully prepared ${results.length} media buffer(s) for URL: ${url}`,
      );
      return results;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Error downloading Instagram media for ${url}: ${error.message}`,
          error.stack,
        );
        const responseData = error.response?.data as
          | { message?: string }
          | undefined;
        if (responseData) {
          this.logger.debug(
            `Axios error response data: ${JSON.stringify(responseData)}`,
          );
        }
        throw new Error(
          `Failed to download media: ${responseData?.message || error.message}`,
        );
      } else if (error instanceof Error) {
        this.logger.error(
          `Error downloading Instagram media for ${url}: ${error.message}`,
          error.stack,
        );
        throw new Error(`Failed to download media: ${error.message}`);
      } else {
        this.logger.error(
          `Error downloading Instagram media for ${url}: ${String(error)}`,
        );
        throw new Error(`Failed to download media: ${String(error)}`);
      }
    }
  }
}
