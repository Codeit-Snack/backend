import { HttpStatus } from '@nestjs/common';

/**
 * 애플리케이션 에러 코드 정의
 * 각 코드는 HTTP 상태와 매핑되며, 클라이언트에서 에러 유형 식별에 사용
 */
export enum ErrorCode {
  // 400 Bad Request - 잘못된 요청
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  BAD_REQUEST = 'BAD_REQUEST',
  INVALID_INPUT = 'INVALID_INPUT',

  // 401 Unauthorized - 인증 필요
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',

  // 403 Forbidden - 권한 없음
  FORBIDDEN = 'FORBIDDEN',
  ACCESS_DENIED = 'ACCESS_DENIED',

  // 404 Not Found - 리소스 없음
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // 409 Conflict - 충돌
  CONFLICT = 'CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CATEGORY_HAS_CHILDREN = 'CATEGORY_HAS_CHILDREN',
  CATEGORY_HAS_PRODUCTS = 'CATEGORY_HAS_PRODUCTS',

  // 429 Too Many Requests - 요청 제한 초과
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // 500 Internal Server Error - 서버 오류
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/** ErrorCode에 대응하는 HTTP 상태 코드 */
export const ERROR_CODE_TO_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
  [ErrorCode.INVALID_INPUT]: HttpStatus.BAD_REQUEST,
  [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.TOKEN_INVALID]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCode.ACCESS_DENIED]: HttpStatus.FORBIDDEN,
  [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.RESOURCE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCode.DUPLICATE_ENTRY]: HttpStatus.CONFLICT,
  [ErrorCode.ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.CATEGORY_HAS_CHILDREN]: HttpStatus.CONFLICT,
  [ErrorCode.CATEGORY_HAS_PRODUCTS]: HttpStatus.CONFLICT,
  [ErrorCode.TOO_MANY_REQUESTS]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.INTERNAL_SERVER_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.DATABASE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.UNKNOWN_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** HTTP 상태 코드 → ErrorCode 매핑 (AppException이 아닌 경우 사용) */
export const HTTP_STATUS_TO_ERROR_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
  [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.INTERNAL_SERVER_ERROR,
};
