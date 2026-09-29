import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, AppConfig } from '../config';
import { OcpiModule } from '../ocpi/ocpi.module';
import { ChargingService } from './charging.service';
import { DeviceGuard } from './device-auth';
import { DeviceController } from './device.controller';

@Module({
  imports: [
    OcpiModule,
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.DEVICE_JWT_SECRET,
        signOptions: { algorithm: 'HS256', issuer: 'super-cables' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'super-cables' },
      }),
    }),
  ],
  controllers: [DeviceController],
  providers: [ChargingService, DeviceGuard],
})
export class DeviceModule {}
