import { Module } from '@nestjs/common';
import { OcpiModule } from '../ocpi/ocpi.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [OcpiModule],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
