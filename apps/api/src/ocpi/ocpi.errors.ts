import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { OcpiStatus, ocpiError } from '@super-cables/ocpi';
import type { Response } from 'express';

/** An error that should be returned to the peer inside an OCPI envelope. */
export class OcpiException extends HttpException {
  constructor(
    readonly ocpiStatus: number,
    message: string,
    httpStatus: number = HttpStatus.BAD_REQUEST,
  ) {
    super(message, httpStatus);
  }
}

export const unknownLocation = (id: string) =>
  new OcpiException(OcpiStatus.UNKNOWN_LOCATION, `Unknown location ${id}`, HttpStatus.NOT_FOUND);

export const invalidParams = (message: string) =>
  new OcpiException(OcpiStatus.INVALID_PARAMETERS, message);

/** Wraps every error on OCPI routes in the OCPI response envelope. */
@Catch()
export class OcpiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('OCPI');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof OcpiException) {
      res.status(exception.getStatus()).json(ocpiError(exception.ocpiStatus, exception.message));
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const ocpiStatus = status >= 500 ? OcpiStatus.SERVER_ERROR : OcpiStatus.CLIENT_ERROR;
      res.status(status).json(ocpiError(ocpiStatus, exception.message));
      return;
    }
    this.logger.error(exception);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(ocpiError(OcpiStatus.SERVER_ERROR, 'Internal error'));
  }
}
