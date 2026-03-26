import { HttpException } from '@nestjs/common';
import { ErrorCode, ERROR_CODE_TO_HTTP_STATUS } from '../enums/error-code.enum';

export interface AppExceptionResponse {
  errorCode: ErrorCode;
  message: string | string[];
}

/**
 * 애플리케이션 에러 코드를 사용하는 커스텀 예외
 * 서비스/컨트롤러에서 throw new AppException(ErrorCode.USER_NOT_FOUND)` 형태로 사용
 */
export class AppException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    message?: string | string[],
    status?: number,
  ) {
    const httpStatus = status ?? ERROR_CODE_TO_HTTP_STATUS[errorCode];
    const response: AppExceptionResponse = {
      errorCode,
      message: message ?? errorCode,
    };
    super(response, httpStatus);
  }
}
