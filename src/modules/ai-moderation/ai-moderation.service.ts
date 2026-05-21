import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportSeverity } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

export interface AiModerationResult {
  severity: ReportSeverity;
  toxicityScore: number;
  summary: string;
  repeatedIncidentHints: string[];
}

@Injectable()
export class AiModerationService {
  private readonly logger = new Logger(AiModerationService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async classifyReport(text: string): Promise<AiModerationResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<AiModerationResult>(
          `${this.configService.getOrThrow<string>('AI_SERVICE_URL')}/moderate`,
          { text },
          {
            headers: {
              authorization: `Bearer ${this.configService.getOrThrow<string>('AI_SERVICE_API_KEY')}`,
            },
            timeout: 10_000,
          },
        ),
      );

      return {
        severity: response.data.severity,
        toxicityScore: response.data.toxicityScore,
        summary: response.data.summary,
        repeatedIncidentHints: response.data.repeatedIncidentHints ?? [],
      };
    } catch (error) {
      this.logger.warn({ err: error }, 'AI moderation service unavailable; using UNKNOWN result');
      return {
        severity: ReportSeverity.UNKNOWN,
        toxicityScore: 0,
        summary: 'AI moderation unavailable.',
        repeatedIncidentHints: [],
      };
    }
  }
}
