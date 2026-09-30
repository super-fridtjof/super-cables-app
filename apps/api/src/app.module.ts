import { Controller, DynamicModule, Get, Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AppConfig } from './config';
import { ConfigModule } from './config.module';
import { DeviceModule } from './device/device.module';
import { OcpiModule } from './ocpi/ocpi.module';
import { PrismaModule } from './prisma/prisma.module';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { ok: true };
  }
}

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(config), PrismaModule, OcpiModule, AdminModule, DeviceModule],
      controllers: [HealthController],
    };
  }
}
