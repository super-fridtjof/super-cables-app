import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { AuthorizationInfo, OcpiStatus, ocpiSuccess } from '@super-cables/ocpi';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { OcpiAuthGuard } from './ocpi-auth.guard';
import { OcpiException, OcpiExceptionFilter } from './ocpi.errors';
import { OCPI_VERSION_BASE, OcpiUrls } from './ocpi-urls';
import { TokensService } from './tokens.service';

const MAX_LIMIT = 100;

/** Tokens sender interface: CPOs sync our tokens and ask us to authorize them in real time. */
@Controller(`${OCPI_VERSION_BASE}/tokens`)
@UseGuards(OcpiAuthGuard)
@UseFilters(OcpiExceptionFilter)
export class TokensController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly urls: OcpiUrls,
  ) {}

  @Get()
  async list(
    @Query('offset') offsetParam: string | undefined,
    @Query('limit') limitParam: string | undefined,
    @Query('date_from') dateFrom: string | undefined,
    @Query('date_to') dateTo: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const offset = Math.max(0, Number(offsetParam ?? 0) || 0);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(limitParam ?? MAX_LIMIT) || MAX_LIMIT));
    const where = {
      lastUpdated: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lt: new Date(dateTo) } : {}),
      },
    };
    const [total, rows] = await Promise.all([
      this.prisma.token.count({ where }),
      this.prisma.token.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: limit,
      }),
    ]);
    res.setHeader('X-Total-Count', String(total));
    res.setHeader('X-Limit', String(limit));
    if (offset + rows.length < total) {
      const next = new URL(this.urls.module('tokens'));
      for (const [k, v] of Object.entries(req.query)) next.searchParams.set(k, String(v));
      next.searchParams.set('offset', String(offset + limit));
      next.searchParams.set('limit', String(limit));
      res.setHeader('Link', `<${next.toString()}>; rel="next"`);
    }
    return ocpiSuccess(rows.map((r) => this.tokens.toOcpi(r)));
  }

  @Post(':uid/authorize')
  async authorize(@Param('uid') uid: string) {
    const row = await this.prisma.token.findUnique({ where: { uid } });
    if (!row) {
      throw new OcpiException(
        OcpiStatus.UNKNOWN_TOKEN,
        `Unknown token ${uid}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return ocpiSuccess<AuthorizationInfo>({
      allowed: row.valid ? 'ALLOWED' : 'BLOCKED',
      token: this.tokens.toOcpi(row),
    });
  }
}
