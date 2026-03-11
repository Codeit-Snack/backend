import { ErrorCode } from '../enums/error-code.enum';

/** API 에러 응답 형식 */
export interface ErrorResponse {
  success: false;
  statusCode: number;
  errorCode: ErrorCode;
  path: string;
  timestamp: string;
  message: string | string[];
}
