import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode, HTTP_STATUS_TO_ERROR_CODE } from '../enums/error-code.enum';
import { ErrorResponse } from '../types/error-response.type';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  constructor(private readonly nodeEnv: string) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    return next.handle().pipe(
      catchError((exception: unknown) => {
        const isAppException = exception instanceof AppException;
        const isHttpException = exception instanceof HttpException;

        const status: number = isHttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

        const isInternalError = status === HttpStatus.INTERNAL_SERVER_ERROR;

        let errorCode: ErrorCode;
        let message: string | string[] = 'Internal server error';

        if (isAppException) {
          errorCode = exception.errorCode;
          const exceptionResponse = exception.getResponse() as {
            message?: string | string[];
          };
          message = exceptionResponse?.message ?? errorCode;
        } else if (isHttpException) {
          errorCode =
            HTTP_STATUS_TO_ERROR_CODE[status] ??
            (status === HttpStatus.BAD_REQUEST
              ? ErrorCode.VALIDATION_FAILED
              : ErrorCode.UNKNOWN_ERROR);

          const exceptionResponse = exception.getResponse();
          if (typeof exceptionResponse === 'string') {
            message = exceptionResponse;
          } else if (
            typeof exceptionResponse === 'object' &&
            exceptionResponse !== null &&
            'message' in exceptionResponse
          ) {
            message = (exceptionResponse as { message: string | string[] })
              .message;
          }
        } else {
          errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
        }

        const errorResponse: ErrorResponse = {
          success: false,
          statusCode: status,
          errorCode,
          path: request.url,
          timestamp: new Date().toISOString(),
          message:
            isInternalError && this.nodeEnv === 'production'
              ? 'Internal server error'
              : message,
        };

        if (!response.headersSent) {
          response.status(status).json(errorResponse);
        }

        return EMPTY;
      }),
    );
  }
}
