import { ApiProperty, ApiPropertyOptions } from '@nestjs/swagger';

const DEFAULT_PASSWORD_DESC =
  '평문 비밀번호. 서버에는 bcrypt 해시만 저장합니다. 전송은 반드시 HTTPS(TLS)로 하세요. 로컬에서 HTTP로 호출하면 개발자 도구 Network에 요청 본문이 그대로 보일 수 있습니다. Swagger UI 마스킹은 OpenAPI `format: password`입니다.';

/** OpenAPI `format: password` + `writeOnly` — 스펙/Swagger UI에서 민감 필드로 표시 */
export function ApiPasswordProperty(
  options: ApiPropertyOptions = {},
): PropertyDecorator {
  return ApiProperty({
    ...options,
    example: options.example ?? '••••••••••',
    description: options.description ?? DEFAULT_PASSWORD_DESC,
    format: 'password',
    writeOnly: true,
  });
}
