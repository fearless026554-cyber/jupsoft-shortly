import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ErrorCodes } from '../../constants/index.js';

@Catch()
export class ErrorHandlerFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    let statusCode = 500;
    let code: string = ErrorCodes.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected internal error occurred';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse() as any;
      
      // Handle NestJS built-in Validation errors (400)
      if (statusCode === 400 && response.message && Array.isArray(response.message)) {
        code = ErrorCodes.VALIDATION_ERROR;
        message = 'Invalid request input';
        details = response.message;
      } else {
        message = response.message || exception.message;
      }
    } else if (exception.code === '23505') {
      // PostgreSQL Unique Constraint Conflict
      statusCode = 409;
      code = ErrorCodes.CONFLICT;
      message = 'Resource conflict';

      if (exception.constraint === 'uq_tenant_alias') {
        code = ErrorCodes.ALIAS_CONFLICT;
        message = 'Alias is already taken for your organization';
      } else if (exception.constraint === 'uq_domain_hostname') {
        code = ErrorCodes.DOMAIN_CONFLICT;
        message = 'Hostname is already registered';
      }
    } else if (exception.code === ErrorCodes.SCREENING_FAILED || 
              (typeof exception.message === 'string' && exception.message.toLowerCase().includes('screening failed'))) {
      statusCode = 400;
      code = ErrorCodes.SCREENING_FAILED;
      message = exception.message;
    } else if (exception.code === ErrorCodes.ALIAS_CONFLICT || 
              (typeof exception.message === 'string' && exception.message.includes('already taken'))) {
      statusCode = 409;
      code = ErrorCodes.ALIAS_CONFLICT;
      message = exception.message || 'Alias is already taken for your organization';
    } else if (exception.statusCode) {
      statusCode = exception.statusCode;
      message = exception.message;
      code = exception.code || code;
    }

    if (statusCode === 500) {
      console.error(exception);
    }

    reply.status(statusCode).send({
      success: false,
      error: { code, message, details },
    });
  }
}
