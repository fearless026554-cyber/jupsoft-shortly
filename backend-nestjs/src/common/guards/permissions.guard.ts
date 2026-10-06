import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { Permission, hasPermission } from '../../constants/permissions.js';
import { UserRoles } from '../../constants/roles.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const auth = request.auth;

    if (!auth) {
      throw new ForbiddenException('Authentication required');
    }

    const userRole = auth.role;

    // Super Admin bypasses all checks
    if (userRole === UserRoles.SUPER_ADMIN) {
      return true;
    }

    const missingPermissions = requiredPermissions.filter(
      (perm) => !hasPermission(userRole, perm)
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Insufficient permissions. Missing: ${missingPermissions.join(', ')}`
      );
    }

    return true;
  }
}
