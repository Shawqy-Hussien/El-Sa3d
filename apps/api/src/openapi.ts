export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'El-Sa3d API',
    version: '1.0.0',
    description:
      'Catalog, inventory, search, authentication, authorization, session, and health endpoints.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    parameters: {
      CsrfTransport: {
        name: 'X-Auth-Transport',
        in: 'header',
        required: false,
        schema: { type: 'string', enum: ['cookie'] },
      },
    },
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      AccessCookie: { type: 'apiKey', in: 'cookie', name: 'access_token' },
      CsrfHeader: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
    },
    schemas: {
      Credentials: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 320 },
          password: { type: 'string', minLength: 12, maxLength: 128 },
        },
      },
      TokenInput: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } },
      },
      RefreshInput: {
        type: 'object',
        properties: { refreshToken: { type: 'string', minLength: 32 } },
      },
      PasswordChange: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 1, maxLength: 128 },
          newPassword: { type: 'string', minLength: 12, maxLength: 128 },
        },
      },
      PasswordResetRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 320 },
        },
      },
      PasswordResetConfirm: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string', minLength: 32 },
          password: { type: 'string', minLength: 12, maxLength: 128 },
        },
      },
      Error: {
        type: 'object',
        required: ['error', 'message'],
        properties: { error: { type: 'string' }, message: { type: 'string' } },
      },
    },
  },
  paths: {
    '/': {
      get: {
        summary: 'API hello',
        responses: { '200': { description: 'API is running.' } },
      },
    },
    '/health/live': {
      get: {
        summary: 'Liveness check',
        responses: { '200': { description: 'Process is alive.' } },
      },
    },
    '/health/ready': {
      get: {
        summary: 'Readiness check',
        responses: {
          '200': { description: 'Database is ready.' },
          '503': { description: 'Database is unavailable.' },
        },
      },
    },
    '/products': {
      get: {
        summary: 'List active products with filters, sorting, and pagination.',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'brand', in: 'query', schema: { type: 'string' } },
          {
            name: 'minPrice',
            in: 'query',
            schema: { type: 'number', minimum: 0 },
          },
          {
            name: 'maxPrice',
            in: 'query',
            schema: { type: 'number', minimum: 0 },
          },
          { name: 'inStock', in: 'query', schema: { type: 'boolean' } },
          { name: 'productType', in: 'query', schema: { type: 'string' } },
          {
            name: 'sort',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['price_asc', 'price_desc', 'newest', 'best_selling'],
            },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1 },
          },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          '200': { description: 'Paged active catalog products.' },
          '400': { description: 'Invalid query.' },
        },
      },
    },
    '/products/{productId}': {
      get: {
        summary: 'Get an active product by ID or slug.',
        parameters: [
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Product details.' },
          '404': { description: 'Product not found.' },
        },
      },
    },
    '/products/categories': {
      get: {
        summary: 'Get the active category tree.',
        responses: { '200': { description: 'Category tree.' } },
      },
    },
    '/products/brands': {
      get: {
        summary: 'Get active brands.',
        responses: { '200': { description: 'Brand list.' } },
      },
    },
    '/products/search': {
      get: {
        summary: 'Search products in Arabic or English.',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string', maxLength: 240 },
          },
        ],
        responses: {
          '200': { description: 'Search results and suggestions.' },
        },
      },
    },
    '/products/search/suggestions': {
      get: {
        summary: 'Get product search suggestions.',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'Suggestions.' } },
      },
    },
    '/products/search/recent': {
      get: {
        summary: 'List recent searches for the authenticated user.',
        security: [{ BearerAuth: [] }, { AccessCookie: [] }],
        responses: {
          '200': { description: 'Recent searches.' },
          '403': { description: 'Role or permission denied.' },
        },
      },
    },
    '/products/inventory/low-stock': {
      get: {
        summary: 'List products at or below inventory reorder levels.',
        security: [{ BearerAuth: [] }, { AccessCookie: [] }],
        responses: {
          '200': { description: 'Low-stock products.' },
          '403': { description: 'Role or permission denied.' },
        },
      },
    },
    '/products/admin/products': {
      post: {
        summary: 'Create a product (catalog:write required).',
        security: [{ BearerAuth: [] }, { AccessCookie: [] }],
        responses: {
          '201': { description: 'Created product.' },
          '403': { description: 'Role or permission denied.' },
        },
      },
    },
    '/products/admin/products/{productId}': {
      patch: {
        summary: 'Edit product fields (catalog:write required).',
        security: [{ BearerAuth: [] }, { AccessCookie: [] }],
        responses: {
          '200': { description: 'Updated product.' },
          '403': { description: 'Role or permission denied.' },
        },
      },
      delete: {
        summary: 'Archive a product (catalog:write required).',
        security: [{ BearerAuth: [] }, { AccessCookie: [] }],
        responses: {
          '200': { description: 'Archived product.' },
          '403': { description: 'Role or permission denied.' },
        },
      },
    },
    '/products/admin/variants/{variantId}/inventory-movements': {
      post: {
        summary: 'Adjust stock and record an inventory movement.',
        security: [{ BearerAuth: [] }, { AccessCookie: [] }],
        responses: {
          '201': { description: 'Recorded movement.' },
          '403': { description: 'Role or permission denied.' },
        },
      },
    },
    '/auth/csrf': {
      get: {
        summary: 'Issue a signed CSRF token for cookie clients.',
        responses: { '200': { description: 'CSRF token issued.' } },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register a customer and send email verification.',
        parameters: [{ $ref: '#/components/parameters/CsrfTransport' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Credentials' },
            },
          },
        },
        responses: {
          '202': { description: 'Generic accepted response.' },
          '400': { description: 'Invalid input.' },
          '429': { description: 'Rate limited.' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate with a password.',
        parameters: [{ $ref: '#/components/parameters/CsrfTransport' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Credentials' },
            },
          },
        },
        responses: {
          '200': { description: 'Bearer token pair or cookie session.' },
          '401': { description: 'Generic credential failure.' },
          '429': { description: 'Rate limited.' },
        },
      },
    },
    '/auth/email/verify': {
      post: {
        summary: 'Consume a single-use email verification token.',
        parameters: [{ $ref: '#/components/parameters/CsrfTransport' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TokenInput' },
            },
          },
        },
        responses: {
          '204': { description: 'Email verified.' },
          '400': { description: 'Invalid or expired token.' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotate a refresh token; reuse revokes the session.',
        parameters: [{ $ref: '#/components/parameters/CsrfTransport' }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshInput' },
            },
          },
        },
        responses: {
          '200': { description: 'New token pair or refreshed cookies.' },
          '401': { description: 'Invalid refresh token.' },
          '429': { description: 'Rate limited.' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Revoke the supplied refresh session and clear cookies.',
        parameters: [{ $ref: '#/components/parameters/CsrfTransport' }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshInput' },
            },
          },
        },
        responses: { '204': { description: 'Session revoked.' } },
      },
    },
    '/auth/change-password': {
      post: {
        summary: 'Change password and revoke all sessions.',
        parameters: [{ $ref: '#/components/parameters/CsrfTransport' }],
        security: [{ BearerAuth: [] }, { AccessCookie: [], CsrfHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PasswordChange' },
            },
          },
        },
        responses: {
          '204': { description: 'Password changed.' },
          '401': { description: 'Authentication required.' },
        },
      },
    },
    '/auth/password-reset/request': {
      post: {
        summary:
          'Request a password reset; response does not reveal account existence.',
        parameters: [{ $ref: '#/components/parameters/CsrfTransport' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PasswordResetRequest' },
            },
          },
        },
        responses: {
          '202': { description: 'Generic accepted response.' },
          '429': { description: 'Rate limited.' },
        },
      },
    },
    '/auth/password-reset/confirm': {
      post: {
        summary: 'Consume a single-use password reset token.',
        parameters: [{ $ref: '#/components/parameters/CsrfTransport' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PasswordResetConfirm' },
            },
          },
        },
        responses: {
          '204': { description: 'Password reset.' },
          '400': { description: 'Invalid or expired token.' },
        },
      },
    },
    '/auth/sessions': {
      get: {
        summary: 'List active sessions for the authenticated user.',
        security: [{ BearerAuth: [] }, { AccessCookie: [] }],
        responses: {
          '200': { description: 'Active sessions.' },
          '401': { description: 'Authentication required.' },
        },
      },
    },
    '/auth/sessions/{sessionId}/revoke': {
      post: {
        summary: 'Revoke one of the authenticated user sessions.',
        parameters: [
          { $ref: '#/components/parameters/CsrfTransport' },
          {
            name: 'sessionId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        security: [{ BearerAuth: [] }, { AccessCookie: [], CsrfHeader: [] }],
        responses: {
          '204': { description: 'Session revoked.' },
          '404': { description: 'Session not found.' },
        },
      },
    },
    '/auth/admin/auth-audit-events': {
      get: {
        summary:
          'List auth audit events (ADMIN role and auth:audit:read permission required).',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1, default: 1 },
          },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        security: [{ BearerAuth: [] }, { AccessCookie: [] }],
        responses: {
          '200': { description: 'Audit events.' },
          '403': { description: 'Role or permission denied.' },
        },
      },
    },
  },
};
