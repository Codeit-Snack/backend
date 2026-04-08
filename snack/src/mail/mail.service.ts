import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('SMTP_USER')?.trim();
    const pass = this.configService.get<string>('SMTP_PASS')?.trim();
    const host = this.configService.get<string>('SMTP_HOST', 'localhost');
    const portRaw = this.configService.get<string | number>('SMTP_PORT', 587);
    const port =
      typeof portRaw === 'number'
        ? portRaw
        : Number.parseInt(String(portRaw), 10) || 587;

    if (!user || !pass) {
      this.logger.warn(
        `SMTP_USER/SMTP_PASS가 비어 있습니다. 실제 발송을 하려면 ${host}:${port}에 맞는 계정을 설정하세요.`,
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
      ...(user && pass && { auth: { user, pass } }),
    });
  }

  async sendTestEmail(to: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM', 'noreply@snack.local'),
        to,
        subject: '[SNACK] 메일 발송 테스트',
        html: '<p>SNACK 메일 설정이 정상적으로 동작합니다.</p>',
      });
    } catch (err) {
      this.logger.error(`sendTestEmail 실패 (to=${to})`, err);
      throw err;
    }
  }

  async sendInvitationEmail(params: {
    to: string;
    inviteeName?: string;
    organizationName: string;
    inviteLink: string;
    expiresInHours: number;
  }) {
    const { to, inviteeName, organizationName, inviteLink, expiresInHours } =
      params;

    const expiresText =
      expiresInHours >= 24
        ? `${Math.floor(expiresInHours / 24)}일`
        : `${expiresInHours}시간`;

    const subject = `[SNACK] ${organizationName} 팀에 초대합니다`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <p style="font-size:18px;line-height:1.6;color:#1f2937;">
          ${inviteeName ? `${inviteeName}님, ` : ''}당신을 <strong>${organizationName}</strong> 팀에 초대합니다!
        </p>
        <p style="font-size:14px;color:#6b7280;margin-bottom:24px;">
          아래 버튼을 클릭하여 ${expiresText} 이내에 초대를 수락해 주세요.
        </p>
        <a href="${inviteLink}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">초대 수락하기</a>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px;">이 링크는 ${expiresText} 후 만료됩니다.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM', 'noreply@snack.local'),
        to,
        subject,
        html,
      });
    } catch (err) {
      this.logger.error(`sendInvitationEmail 실패 (to=${to})`, err);
      throw err;
    }
  }

  async sendPasswordResetEmail(params: { to: string; resetLink: string }) {
    const { to, resetLink } = params;
    const subject = '[SNACK] 비밀번호 재설정';
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <p style="font-size:18px;line-height:1.6;color:#1f2937;">
          비밀번호 재설정을 요청하셨습니다.
        </p>
        <p style="font-size:14px;color:#6b7280;margin-bottom:24px;">
          아래 링크를 눌러 새 비밀번호를 설정해 주세요. 링크는 제한 시간 후 만료됩니다.
        </p>
        <a href="${resetLink}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">비밀번호 재설정</a>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px;">요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
      </div>
    `;
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM', 'noreply@snack.local'),
        to,
        subject,
        html,
      });
    } catch (err) {
      this.logger.error(`sendPasswordResetEmail 실패 (to=${to})`, err);
      throw err;
    }
  }
}
