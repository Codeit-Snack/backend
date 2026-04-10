import { Test, TestingModule } from '@nestjs/testing';
import { OrgRole } from '@prisma/client';
import { ProductController } from '@/modules/catalog/controllers/product.controller';
import { ProductService } from '@/modules/catalog/services/product.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ErrorCode } from '@/common/enums/error-code.enum';
import type { JwtPayload } from '@/common/types/jwt-payload.type';

describe('ProductController (admin guard)', () => {
  let controller: ProductController;
  const member: JwtPayload = {
    sub: '1',
    email: 'm@test.com',
    organizationId: '1',
    role: OrgRole.MEMBER,
    sessionId: '1',
  };
  const admin: JwtPayload = {
    sub: '2',
    email: 'a@test.com',
    organizationId: '1',
    role: OrgRole.ADMIN,
    sessionId: '2',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        {
          provide: ProductService,
          useValue: {
            update: jest.fn().mockResolvedValue({ id: 1 }),
            remove: jest.fn().mockResolvedValue(undefined),
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ProductController);
  });

  it('update throws for MEMBER', () => {
    expect(() =>
      controller.update(member, 1, 1, {} as never),
    ).toThrow(AppException);
    try {
      controller.update(member, 1, 1, {} as never);
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).errorCode).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it('update delegates to service for ADMIN', async () => {
    const svc = (
      controller as unknown as { productService: ProductService }
    ).productService;
    await controller.update(admin, 1, 1, {} as never);
    expect(svc.update).toHaveBeenCalledWith(1, 1, {});
  });

  it('remove throws for MEMBER', async () => {
    await expect(controller.remove(member, 1, 1)).rejects.toThrow(
      AppException,
    );
  });

  it('remove delegates to service for SUPER_ADMIN', async () => {
    const superUser: JwtPayload = { ...admin, role: OrgRole.SUPER_ADMIN };
    const svc = (
      controller as unknown as { productService: ProductService }
    ).productService;
    await controller.remove(superUser, 1, 1);
    expect(svc.remove).toHaveBeenCalledWith(1, 1);
  });
});
