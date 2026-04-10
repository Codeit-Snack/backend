import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { BudgetMonthlyDefaultController } from '@/modules/finance/controllers/budget-monthly-default.controller';
import { BudgetPeriodController } from '@/modules/finance/controllers/budget-period.controller';
import { BudgetReservationController } from '@/modules/finance/controllers/budget-reservation.controller';
import { ExpenseController } from '@/modules/finance/controllers/expense.controller';
import { AuditLogController } from '@/modules/finance/controllers/audit-log.controller';
import { BudgetPeriodService } from '@/modules/finance/services/budget-period.service';
import { BudgetReservationService } from '@/modules/finance/services/budget-reservation.service';
import { ExpenseService } from '@/modules/finance/services/expense.service';
import { FinanceAuditQueryService } from '@/modules/finance/services/finance-audit-query.service';

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
