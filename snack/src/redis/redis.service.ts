import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL')?.trim();
    if (redisUrl) {
      this.client = new Redis(redisUrl);
      return;
    }

    const host =
      this.configService.get<string>('REDIS_HOST', 'localhost')?.trim() ||
      'localhost';
    const portRaw = this.configService.get<string>('REDIS_PORT')?.trim();
    if (portRaw === undefined || portRaw === '') {
      throw new Error(
        'REDIS_PORT is not set. Add it to your .env (see .env.example).',
      );
    }
    const port = Number(portRaw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(
        'REDIS_PORT must be an integer between 1 and 65535 (see .env.example).',
      );
    }
    const password = this.configService.get<string>('REDIS_PASSWORD', '');
    const useTls =
      this.configService.get<string>('REDIS_TLS', 'false') === 'true';

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      ...(useTls && { tls: { rejectUnauthorized: true } }),
    });
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
