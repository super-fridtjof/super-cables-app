import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { safeEqual } from '../common/crypto';
import { APP_CONFIG, AppConfig } from '../config';

/** Operator-only endpoints, authenticated with a shared key until staff login exists. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const key = context.switchToHttp().getRequest<Request>().header('x-admin-key');
    if (!key || !safeEqual(key, this.config.ADMIN_API_KEY)) throw new UnauthorizedException();
    return true;
  }
}
