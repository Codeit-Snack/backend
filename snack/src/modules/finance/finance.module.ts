import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BudgetPeriodController } from './controllers/budget-period.controller';
import { BudgetReservationController } from './controllers/budget-reservation.controller';
import { ExpenseController } from './controllers/expense.controller';
import { AuditLogController } from './controllers/audit-log.controller';
import { BudgetPeriodService } from './services/budget-period.service';
import { BudgetReservationService } from './services/budget-reservation.service';
import { ExpenseService } from './services/expense.service';
import { FinanceAuditQueryService } from './services/finance-audit-query.service';

@Module({
  imports: [AuditModule],
  controllers: [
    BudgetPeriodController,
    BudgetReservationController,
    ExpenseController,
    AuditLogController,
  ],
  providers: [
    BudgetPeriodService,
    BudgetReservationService,
    ExpenseService,
    FinanceAuditQueryService,
  ],
})
export class FinanceModule {}
