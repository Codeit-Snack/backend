import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BudgetMonthlyDefaultController } from './controllers/budget-monthly-default.controller';
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
    BudgetMonthlyDefaultController,
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
  exports: [BudgetPeriodService, BudgetReservationService, ExpenseService],
})
export class FinanceModule {}
